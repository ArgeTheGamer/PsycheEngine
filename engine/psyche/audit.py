"""Benchmark auditor, independent from the engine.

Two measurements, same prompts for both manuals:
1. internal contradictions: one pass over the whole manual, pairs of conflicting quotes;
2. fact violations: each section against the company's input facts (not the engine's canon).

Every reported quote must appear verbatim in the cited section, otherwise the
report is discarded, so the auditor cannot inflate the count with invented text.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from .agents import normalize, prompt
from .baseline import render_manual
from .canon import Canon
from .engine import AcceptedSection
from .llm import LLM

Kind = Literal["limit", "zone", "role", "step_order", "reference"]


class Contradiction(BaseModel):
    category: Kind
    section_a: str
    quote_a: str
    section_b: str
    quote_b: str
    explanation: str


class Contradictions(BaseModel):
    contradictions: list[Contradiction]


class Violation(BaseModel):
    category: Kind
    fact_id: str
    quote: str
    explanation: str


class Violations(BaseModel):
    violations: list[Violation]


class SectionViolation(Violation):
    section_id: str


class Audit(BaseModel):
    label: str
    chapters: int
    contradictions: list[Contradiction]
    violations: list[SectionViolation]
    discarded: int  # reports whose quotes were not found in the text
    contradictions_per_chapter: list[int]
    violations_per_chapter: list[int]


def _quoted(quote: str, text: str) -> bool:
    q = normalize(quote)
    return bool(q) and q in normalize(text)


def audit(llm: LLM, label: str, sections: list[AcceptedSection], facts: Canon) -> Audit:
    by_id = {s.id: s for s in sections}
    chapter_of = {s.id: s.chapter for s in sections}
    chapters = max(chapter_of.values())

    found = llm.structured(
        agent="auditor",
        messages=[{"role": "user", "content": prompt("auditor_internal", manual=render_manual(sections))}],
        schema=Contradictions,
        reasoning_effort="high",
        tags={"audit": label, "pass": "internal"},
    ).contradictions
    contradictions = [
        c
        for c in found
        if c.section_a != c.section_b
        and c.section_a in by_id
        and c.section_b in by_id
        and _quoted(c.quote_a, by_id[c.section_a].text)
        and _quoted(c.quote_b, by_id[c.section_b].text)
    ]
    discarded = len(found) - len(contradictions)

    violations: list[SectionViolation] = []
    for s in sections:
        reported = llm.structured(
            agent="auditor",
            messages=[
                {
                    "role": "user",
                    "content": prompt(
                        "auditor_facts", facts=facts.render(), section_id=s.id, section_title=s.title, text=s.text
                    ),
                }
            ],
            schema=Violations,
            reasoning_effort="high",
            tags={"audit": label, "pass": "facts", "chapter": s.chapter},
        ).violations
        kept = [v for v in reported if facts.has(v.fact_id) and _quoted(v.quote, s.text)]
        discarded += len(reported) - len(kept)
        violations += [SectionViolation(section_id=s.id, **v.model_dump()) for v in kept]

    # A contradiction becomes visible when its later passage is written.
    per_c = [0] * chapters
    for c in contradictions:
        per_c[max(chapter_of[c.section_a], chapter_of[c.section_b]) - 1] += 1
    per_v = [0] * chapters
    for v in violations:
        per_v[chapter_of[v.section_id] - 1] += 1

    return Audit(
        label=label,
        chapters=chapters,
        contradictions=contradictions,
        violations=violations,
        discarded=discarded,
        contradictions_per_chapter=per_c,
        violations_per_chapter=per_v,
    )

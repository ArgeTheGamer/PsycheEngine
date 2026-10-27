"""Benchmark auditor, independent from the engine.

Two measurements, same prompts for both manuals:
1. contradictions: one pass over all documents together, pairs of conflicting quotes,
   counted within each document and between documents;
2. fact violations: each section against the company's input facts (not the engine's canon).

Every reported quote must appear verbatim in the cited section, otherwise the
report is discarded, so the auditor cannot inflate the count with invented text.
"""

from __future__ import annotations

from collections import Counter
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
    contradictions: list[Contradiction]
    violations: list[SectionViolation]
    discarded: int  # reports whose quotes were not found in the text
    within: dict[str, int]  # document id -> contradictions inside that document
    between: dict[str, int]  # "docA|docB" (sorted) -> contradictions across the two documents
    violations_per_doc: dict[str, int]


def _quoted(quote: str, text: str) -> bool:
    q = normalize(quote)
    return bool(q) and q in normalize(text)


def _internal(llm: LLM, label: str, sections: list[AcceptedSection]) -> tuple[int, Contradictions]:
    """One pass over the whole manual; returns (reports made, reports whose quotes check out)."""
    by_id = {s.id: s for s in sections}
    found = llm.structured(
        agent="auditor",
        messages=[{"role": "user", "content": prompt("auditor_internal", manual=render_manual(sections))}],
        schema=Contradictions,
        reasoning_effort="high",
        tags={"audit": label, "pass": "internal"},
    ).contradictions
    kept = [
        c
        for c in found
        if c.section_a != c.section_b
        and c.section_a in by_id
        and c.section_b in by_id
        and _quoted(c.quote_a, by_id[c.section_a].text)
        and _quoted(c.quote_b, by_id[c.section_b].text)
    ]
    return len(found), Contradictions(contradictions=kept)


def audit_internal(llm: LLM, label: str, sections: list[AcceptedSection]) -> Contradictions:
    return _internal(llm, label, sections)[1]


def audit(llm: LLM, label: str, sections: list[AcceptedSection], facts: Canon) -> Audit:
    doc_of = {s.id: s.doc for s in sections}

    raw, kept = _internal(llm, label, sections)
    contradictions = kept.contradictions
    discarded = raw - len(contradictions)

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

    within: Counter[str] = Counter()
    between: Counter[str] = Counter()
    for c in contradictions:
        a, b = doc_of[c.section_a], doc_of[c.section_b]
        if a == b:
            within[a] += 1
        else:
            between["|".join(sorted((a, b)))] += 1

    return Audit(
        label=label,
        contradictions=contradictions,
        violations=violations,
        discarded=discarded,
        within=dict(within),
        between=dict(between),
        violations_per_doc=dict(Counter(doc_of[v.section_id] for v in violations)),
    )

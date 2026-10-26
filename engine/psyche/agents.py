"""The four agents of the generation loop: planner, writer, critic and canon editor.

Each agent is one structured call: a prompt from prompts/*.md and a Pydantic
schema for the reply. Output schemas have no defaults, so they stay valid under
strict JSON-schema decoding.
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from .canon import Canon, Category, Fact
from .llm import LLM

PROMPTS = Path(__file__).parent / "prompts"


def prompt(name: str, **values: object) -> str:
    return (PROMPTS / f"{name}.md").read_text(encoding="utf-8").format(**values)


# --- planner ---------------------------------------------------------------


class PlannedSection(BaseModel):
    title: str
    purpose: str
    fact_ids: list[str]


class PlannedChapter(BaseModel):
    title: str
    sections: list[PlannedSection]


class Outline(BaseModel):
    chapters: list[PlannedChapter]


class Section(BaseModel):
    """A planned section with its stable id, e.g. ch04.s2."""

    id: str
    chapter: int
    chapter_title: str
    title: str
    purpose: str
    fact_ids: list[str]


def plan(llm: LLM, brief: str, canon: Canon, chapters: int) -> list[Section]:
    outline = llm.structured(
        agent="planner",
        messages=[{"role": "user", "content": prompt("planner", chapters=chapters, brief=brief, canon=canon.render())}],
        schema=Outline,
        reasoning_effort="medium",
    )
    sections = []
    for c, chapter in enumerate(outline.chapters, 1):
        for s, planned in enumerate(chapter.sections, 1):
            sections.append(
                Section(
                    id=f"ch{c:02d}.s{s}",
                    chapter=c,
                    chapter_title=chapter.title,
                    title=planned.title,
                    purpose=planned.purpose,
                    fact_ids=[i for i in dict.fromkeys(planned.fact_ids) if canon.has(i)],
                )
            )
    return sections


def toc(sections: list[Section]) -> str:
    lines, chapter = [], 0
    for s in sections:
        if s.chapter != chapter:
            chapter = s.chapter
            lines.append(f"Chapter {s.chapter}: {s.chapter_title}")
        lines.append(f"  {s.id} {s.title}")
    return "\n".join(lines)


# --- writer ----------------------------------------------------------------


class Draft(BaseModel):
    text: str
    cited_fact_ids: list[str]


class Issue(BaseModel):
    category: Literal["limit", "zone", "role", "step_order", "reference"]
    fact_id: str
    quote: str
    problem: str


def write(
    llm: LLM,
    canon: Canon,
    section: Section,
    contents: str,
    language: str = "English",
    words: int = 450,
    issues: list[Issue] | None = None,
    revision: str = "",
) -> Draft:
    feedback = revision
    if issues:
        listed = "\n".join(f'- "{i.quote}": {i.problem}' for i in issues)
        feedback += (
            "\nYour previous draft was rejected by the consistency critic. Fix every point below and keep the rest:"
            f"\n<rejected>\n{listed}\n</rejected>\n"
        )
    return llm.structured(
        agent="writer",
        messages=[
            {
                "role": "user",
                "content": prompt(
                    "writer",
                    company=canon.company.name,
                    section_id=section.id,
                    section_title=section.title,
                    chapter_number=section.chapter,
                    chapter_title=section.chapter_title,
                    purpose=section.purpose,
                    language=language,
                    words=words,
                    facts=canon.render(section.fact_ids),
                    canon=canon.render(),
                    toc=contents,
                    feedback=feedback,
                ),
            }
        ],
        schema=Draft,
        reasoning_effort="low",
        tags={"chapter": section.chapter, "section": section.id},
    )


# --- critic ----------------------------------------------------------------


class Verdict(BaseModel):
    accepted: bool
    issues: list[Issue]


def critique(llm: LLM, canon: Canon, section: Section, text: str) -> Verdict:
    verdict = llm.structured(
        agent="critic",
        messages=[
            {
                "role": "user",
                "content": prompt(
                    "critic", canon=canon.render(), section_id=section.id, section_title=section.title, text=text
                ),
            }
        ],
        schema=Verdict,
        reasoning_effort="medium",
        tags={"chapter": section.chapter, "section": section.id},
    )
    # A quote that is not in the text is a hallucinated issue; drop it rather than force a rewrite.
    haystack = normalize(text)
    issues = [i for i in verdict.issues if normalize(i.quote) and normalize(i.quote) in haystack]
    return Verdict(accepted=not issues, issues=issues)


def normalize(s: str) -> str:
    s = s.replace("’", "'").replace("“", '"').replace("”", '"').replace("–", "-")
    return " ".join(s.lower().split()).strip(" .\"'")


# --- canon editor ----------------------------------------------------------


class NewFact(BaseModel):
    category: Category
    subject: str
    attribute: str
    value: str
    unit: str
    statement: str


class NewFacts(BaseModel):
    facts: list[NewFact]


PREFIX = {
    "limit": "LIM",
    "zone": "ZON",
    "role": "ROL",
    "responsibility": "RSP",
    "procedure": "PRC",
    "step_order": "ORD",
    "equipment": "EQP",
    "schedule": "SCH",
    "rule": "RUL",
}


def extract_new_facts(llm: LLM, canon: Canon, section: Section, text: str) -> list[Fact]:
    found = llm.structured(
        agent="canon_editor",
        messages=[
            {"role": "user", "content": prompt("canon_editor", canon=canon.render(), section_id=section.id, text=text)}
        ],
        schema=NewFacts,
        reasoning_effort="low",
        tags={"chapter": section.chapter, "section": section.id},
    )
    taken = {f.id for f in canon.facts}
    facts = []
    for new in found.facts:
        prefix = f"F-{PREFIX[new.category]}-"
        n = 1 + max((int(i.removeprefix(prefix)) for i in taken if i.startswith(prefix)), default=0)
        fact_id = f"{prefix}{n:02d}"
        taken.add(fact_id)
        facts.append(Fact(id=fact_id, **new.model_dump()))
    return facts

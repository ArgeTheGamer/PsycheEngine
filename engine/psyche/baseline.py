"""Baseline: the same model writes the same sections without the engine's loop.

Variants share the engine's plan (tables of contents, section purposes, length):
- separate sessions (default): each document is written in its own session from
  the owner's brief and its own text so far, the way a company really produces them;
- shared context: every document also sees all documents written before it;
- with_facts: additionally the full structured fact list.
What all lack is the engine's loop: no canon updates and no critic.
"""

from __future__ import annotations

import json
from pathlib import Path

import openai

from . import agents
from .agents import Section, prompt
from .canon import Canon
from .engine import AcceptedSection, Settings, Team


def render_manual(sections: list[AcceptedSection]) -> str:
    parts, doc, chapter = [], "", 0
    for s in sections:
        if s.doc != doc:
            doc, chapter = s.doc, 0
            parts.append(f"# {s.doc_title}")
        if s.chapter != chapter:
            chapter = s.chapter
            parts.append(f"## Chapter {s.chapter}: {s.chapter_title}")
        parts.append(f"### {s.id} {s.title}\n\n{s.text}")
    return "\n\n".join(parts)


REFUSED = "[No text: the model provider's content filter refused this section.]"


def _complete_or_refusal(llm, messages: list[dict[str, str]], tags: dict) -> tuple[str, int]:
    """Plain completion; a provider content-filter refusal is retried once, then recorded instead of crashing."""
    for _ in range(2):
        try:
            return llm.complete(agent="baseline", messages=messages, reasoning_effort="low", tags=tags), 1
        except openai.BadRequestError as e:
            if "content management policy" not in str(e):
                raise
    return REFUSED, 0  # attempts=0 marks a refused section


def run_baseline(
    brief: str,
    canon: Canon,
    plan: list[Section],
    out: Path,
    settings: Settings,
    team: Team,
    with_facts: bool = False,
    shared_context: bool = False,
) -> list[AcceptedSection]:
    """Write the planned sections in order. Each document is its own session (it sees only its own text so
    far) unless shared_context is set, in which case every document sees everything written before it."""
    out.mkdir(parents=True, exist_ok=True)
    if settings.only_chapters:
        plan = [s for s in plan if s.chapter <= settings.only_chapters]
    contents = {doc: agents.toc([s for s in plan if s.doc == doc]) for doc in dict.fromkeys(s.doc for s in plan)}
    llm = team("baseline")
    facts_block = f"Company facts (authoritative):\n<facts>\n{canon.render()}\n</facts>\n\n" if with_facts else ""
    written: list[AcceptedSection] = []
    if (out / "sections.json").exists():  # resume an interrupted baseline
        written = [AcceptedSection(**s) for s in json.loads((out / "sections.json").read_text(encoding="utf-8"))]
    done = {w.id for w in written}
    for section in plan:
        if section.id in done:
            continue
        messages = [
                {
                    "role": "user",
                    "content": prompt(
                        "baseline",
                        company=canon.company.name,
                        brief=brief,
                        facts_block=facts_block,
                        facts_note=", the facts" if with_facts else "",
                        document=section.doc_title,
                        toc=contents[section.doc],
                        context_title="Everything written so far:" if shared_context else "This document so far:",
                        manual=render_manual(written if shared_context else [w for w in written if w.doc == section.doc])
                        or "(nothing written yet)",
                        section_id=section.id,
                        section_title=section.title,
                        chapter_number=section.chapter,
                        chapter_title=section.chapter_title,
                        purpose=section.purpose,
                        language=settings.language,
                        words=settings.words_per_section,
                    ),
                }
            ]
        text, attempts = _complete_or_refusal(llm, messages, {"doc": section.doc, "chapter": section.chapter, "section": section.id})
        written.append(
            AcceptedSection(
                id=section.id,
                doc=section.doc,
                doc_title=section.doc_title,
                chapter=section.chapter,
                chapter_title=section.chapter_title,
                title=section.title,
                text=text.strip(),
                fact_ids=[],
                attempts=attempts,
                unresolved_issues=[],
            )
        )
        (out / "sections.json").write_text(
            json.dumps([w.model_dump() for w in written], indent=2, ensure_ascii=False), encoding="utf-8"
        )
    return written

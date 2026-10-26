"""Baseline: the same model writes the same sections with everything in the prompt.

Two variants share the engine's table of contents, section purposes, length
and the complete text written so far:
- "brief": the owner's description only, as a typical user would prompt;
- "brief+facts": additionally the full structured fact list, the strongest
  baseline we can build.
What both lack is the engine's loop: no canon updates and no critic.
"""

from __future__ import annotations

import json
from pathlib import Path

from . import agents
from .agents import Section, prompt
from .canon import Canon
from .engine import AcceptedSection, Settings, Team


def render_manual(sections: list[AcceptedSection]) -> str:
    parts, chapter = [], 0
    for s in sections:
        if s.chapter != chapter:
            chapter = s.chapter
            parts.append(f"## Chapter {s.chapter}: {s.chapter_title}")
        parts.append(f"### {s.id} {s.title}\n\n{s.text}")
    return "\n\n".join(parts)


def run_baseline(
    brief: str,
    canon: Canon,
    plan: list[Section],
    out: Path,
    settings: Settings,
    team: Team,
    with_facts: bool = False,
) -> list[AcceptedSection]:
    out.mkdir(parents=True, exist_ok=True)
    if settings.only_chapters:
        plan = [s for s in plan if s.chapter <= settings.only_chapters]
    contents = agents.toc(plan)
    llm = team("baseline")
    facts_block = f"Company facts (authoritative):\n<facts>\n{canon.render()}\n</facts>\n\n" if with_facts else ""
    written: list[AcceptedSection] = []
    for section in plan:
        text = llm.complete(
            agent="baseline",
            messages=[
                {
                    "role": "user",
                    "content": prompt(
                        "baseline",
                        company=canon.company.name,
                        brief=brief,
                        facts_block=facts_block,
                        facts_note=", the facts" if with_facts else "",
                        toc=contents,
                        manual=render_manual(written) or "(nothing written yet)",
                        section_id=section.id,
                        section_title=section.title,
                        chapter_number=section.chapter,
                        chapter_title=section.chapter_title,
                        purpose=section.purpose,
                        language=settings.language,
                        words=settings.words_per_section,
                    ),
                }
            ],
            reasoning_effort="low",
            tags={"chapter": section.chapter, "section": section.id},
        )
        written.append(
            AcceptedSection(
                id=section.id,
                chapter=section.chapter,
                chapter_title=section.chapter_title,
                title=section.title,
                text=text.strip(),
                fact_ids=[],
                attempts=1,
                unresolved_issues=[],
            )
        )
        (out / "sections.json").write_text(
            json.dumps([w.model_dump() for w in written], indent=2, ensure_ascii=False), encoding="utf-8"
        )
    return written

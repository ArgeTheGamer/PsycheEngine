"""Notices after a fact change: a letter to clients and a memo to staff.

Updating the documents is half the job; the people who rely on them also have
to hear about it. Each notice is drafted from the change, the rewritten
sections and the canon, then checked by the same critic as every section.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from . import agents
from .agents import Issue, Section, prompt
from .canon import Canon, FactChange
from .engine import AcceptedSection, Event, EventLog, Team

AUDIENCES = {
    "client": dict(
        kind="client notice",
        audience="the warehouse's clients",
        guidance="Only mention what affects service to clients (times, capacities, handling, charges, quality); "
        "point to the Client Service Level Agreement. If nothing in the change affects clients, say so in one "
        "sentence and keep the notice brief.",
        signature="Warehouse Management, {company}",
    ),
    "staff": dict(
        kind="staff memo for the notice board",
        audience="everyone working on site",
        guidance="Say what people must do differently from now on, who is affected (roles) and where the rule "
        "is written (Operations Manual, Health & Safety Instruction, Job Descriptions).",
        signature="Warehouse Manager, {company}",
    ),
}


class NoticeDraft(BaseModel):
    subject: str
    body: str
    cited_section_ids: list[str]
    cited_fact_ids: list[str]


class Notice(BaseModel):
    audience: Literal["client", "staff"]
    subject: str
    body: str
    cited_section_ids: list[str]
    cited_fact_ids: list[str]
    attempts: int
    unresolved_issues: list[Issue]


def describe(change: FactChange, canon: Canon) -> str:
    fact = canon.fact(change.fact_id)
    lines = [f"{change.fact_id} ({fact.subject}.{fact.attribute}): {change.old_value} -> {change.new_value} {fact.unit}".rstrip()]
    lines += [f"computed knock-on: {d.fact_id} {d.old_value} -> {d.new_value} {canon.fact(d.fact_id).unit}".rstrip() for d in change.derived]
    lines += [f"also updated: {canon.fact(q).statement}" for q in change.quoting]
    return "\n".join(lines)


def write_notices(
    team: Team, canon: Canon, change: FactChange, rewritten: list[AcceptedSection], events: EventLog, max_attempts: int = 2
) -> list[Notice]:
    writer, critic = team("writer"), team("critic")
    listed = "\n\n".join(f"{s.id} | {s.doc_title} | {s.title}\n{s.text}" for s in rewritten) or "(none)"
    notices = []
    for audience, spec in AUDIENCES.items():
        feedback, issues = "", []
        for attempt in range(1, max_attempts + 1):
            draft = writer.structured(
                agent="writer",
                messages=[{"role": "user", "content": prompt(
                    "notice",
                    company=canon.company.name,
                    kind=spec["kind"],
                    audience=spec["audience"],
                    guidance=spec["guidance"],
                    signature=spec["signature"].format(company=canon.company.name),
                    change=describe(change, canon),
                    rewritten=listed,
                    canon=canon.render(),
                ) + feedback}],
                schema=NoticeDraft,
                reasoning_effort="low",
                tags={"notice": audience},
            )
            events.emit(Event("writer", writer.provider.model, "draft" if attempt == 1 else "rewrite", f"{audience} notice: {draft.subject}", f"notice.{audience}"))
            pseudo = Section(id=f"notice.{audience}", doc="notice", doc_title=spec["kind"], chapter=0,
                             chapter_title="", title=draft.subject, purpose="", fact_ids=[])
            verdict = agents.critique(critic, canon, pseudo, f"{draft.subject}\n\n{draft.body}")
            issues = verdict.issues
            for issue in issues:
                events.emit(Event("critic", critic.provider.model, "verdict", issue.problem, pseudo.id, accepted=False, quote=issue.quote))
            if verdict.accepted:
                events.emit(Event("critic", critic.provider.model, "verdict", f"{audience} notice consistent with canon", pseudo.id, accepted=True))
                break
            feedback = "\n\nYour previous draft was rejected by the consistency critic. Fix these points:\n" + "\n".join(
                f'- "{i.quote}": {i.problem}' for i in issues
            )
        notices.append(Notice(audience=audience, subject=draft.subject, body=draft.body,
                              cited_section_ids=[i for i in draft.cited_section_ids if any(s.id == i for s in rewritten)],
                              cited_fact_ids=[i for i in draft.cited_fact_ids if canon.has(i)],
                              attempts=attempt, unresolved_issues=issues))
    return notices

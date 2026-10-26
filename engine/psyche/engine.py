"""The generation loop: plan -> (write -> critique)* -> update canon, section by section.

Everything a run produces lands in one directory, which the dashboard reads as is:
    plan.json          planned sections with their fact ids
    sections.json      accepted sections (text + cited facts)
    canon/vNN.json     every canon version
    events.jsonl       what each agent did, including rejected drafts and the critic's quotes
    calls.jsonl        tokens and cost of every model call
"""

from __future__ import annotations

import json
import time
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from pathlib import Path

from pydantic import BaseModel

from . import agents
from .agents import Section
from .canon import Canon, CanonStore
from .config import budget_usd, provider_for
from .llm import LLM, Budget, Tracer


@dataclass
class Event:
    agent: str
    model: str
    kind: str  # plan | draft | verdict | rewrite | canon_update
    message: str
    section_id: str | None = None
    accepted: bool | None = None
    quote: str | None = None
    ts: float = field(default_factory=time.time)


class EventLog:
    def __init__(self, path: Path | None = None):
        self.path = path
        self.events: list[Event] = []

    def emit(self, event: Event) -> None:
        self.events.append(event)
        if self.path:
            with self.path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(asdict(event), ensure_ascii=False) + "\n")


class AcceptedSection(BaseModel):
    id: str
    doc: str = "ops"
    doc_title: str = "Operations Manual"
    chapter: int
    chapter_title: str
    title: str
    text: str
    fact_ids: list[str]
    attempts: int
    unresolved_issues: list[agents.Issue]


@dataclass
class Settings:
    chapters: int = 14  # used when no document list is given: one operations manual
    max_attempts: int = 3
    language: str = "English"
    words_per_section: int = 450
    only_chapters: int | None = None  # generate just the first N chapters of each document (live demo)


class Team:
    """One LLM client per provider, shared budget and call trace across all agents."""

    def __init__(self, budget: Budget, tracer: Tracer, make_llm: Callable[[str], LLM] | None = None):
        self.budget = budget
        self.tracer = tracer
        self._make = make_llm or (lambda agent: LLM(provider_for(agent), budget, tracer))
        self._cache: dict[str, LLM] = {}

    def __call__(self, agent: str) -> LLM:
        if agent not in self._cache:
            self._cache[agent] = self._make(agent)
        return self._cache[agent]


def run(
    brief: str,
    canon: Canon,
    out: Path,
    settings: Settings,
    team: Team | None = None,
    documents: list[agents.Document] | None = None,
) -> list[AcceptedSection]:
    """Write every document from one shared canon, document by document, section by section."""
    documents = documents or [
        agents.Document(id="ops", title="Operations Manual", scope="the warehouse operations manual", chapters=settings.chapters)
    ]
    out.mkdir(parents=True, exist_ok=True)
    store = CanonStore(out / "canon")
    events = EventLog(out / "events.jsonl")
    team = team or Team(Budget(budget_usd()), Tracer(out / "calls.jsonl"))

    accepted: list[AcceptedSection] = []
    if (out / "plan.json").exists():
        # Resume an interrupted run: same plan, latest canon, skip sections already accepted.
        sections = [Section(**s) for s in json.loads((out / "plan.json").read_text(encoding="utf-8"))]
        documents = [agents.Document(**d) for d in json.loads((out / "documents.json").read_text(encoding="utf-8"))]
        if (out / "sections.json").exists():
            accepted = [AcceptedSection(**s) for s in json.loads((out / "sections.json").read_text(encoding="utf-8"))]
        canon = store.latest()
    else:
        store.save(canon)
        planner = team("planner")
        sections = []
        for doc in documents:
            planned = agents.plan(planner, brief, canon, doc)
            sections += planned
            events.emit(Event("planner", planner.provider.model, "plan", f"{doc.title}: {len(planned)} sections in {doc.chapters} chapters"))
        (out / "plan.json").write_text(json.dumps([s.model_dump() for s in sections], indent=2), encoding="utf-8")
        (out / "documents.json").write_text(json.dumps([d.model_dump() for d in documents], indent=2), encoding="utf-8")

    if settings.only_chapters:
        sections = [s for s in sections if s.chapter <= settings.only_chapters]
    contents = {doc.id: agents.toc([s for s in sections if s.doc == doc.id]) for doc in documents}

    done_ids = {a.id for a in accepted}
    for section in sections:
        if section.id in done_ids:
            continue
        done, canon = write_section(team, canon, section, contents[section.doc], settings, events)
        store.save(canon)
        if done.unresolved_issues:
            # Never let the canon editor promote values the critic rejected.
            events.emit(Event("canon_editor", "-", "canon_update", "skipped: section has unresolved issues", section.id))
        else:
            canon = absorb_new_facts(team, canon, section, done.text, events, store)
        accepted.append(done)
        (out / "sections.json").write_text(
            json.dumps([a.model_dump() for a in accepted], indent=2, ensure_ascii=False), encoding="utf-8"
        )
    return accepted


def write_section(
    team: Team,
    canon: Canon,
    section: Section,
    contents: str,
    settings: Settings,
    events: EventLog,
    revision: str = "",
) -> tuple[AcceptedSection, Canon]:
    writer, critic = team("writer"), team("critic")
    issues: list[agents.Issue] = []
    for attempt in range(1, settings.max_attempts + 1):
        draft = agents.write(
            writer, canon, section, contents, settings.language, settings.words_per_section, issues or None, revision
        )
        kind = "rewrite" if attempt > 1 else "draft"
        events.emit(Event("writer", writer.provider.model, kind, f"{section.title} ({len(draft.text.split())} words)", section.id))

        verdict = agents.critique(critic, canon, section, draft.text)
        issues = verdict.issues
        for issue in issues:
            events.emit(
                Event("critic", critic.provider.model, "verdict", issue.problem, section.id, accepted=False, quote=issue.quote)
            )
        if verdict.accepted:
            events.emit(Event("critic", critic.provider.model, "verdict", f"attempt {attempt}: consistent with canon", section.id, accepted=True))
            break

    cited = [i for i in dict.fromkeys(draft.cited_fact_ids + section.fact_ids) if canon.has(i)]
    canon = canon.with_usage(section.id, cited)
    done = AcceptedSection(
        id=section.id,
        doc=section.doc,
        doc_title=section.doc_title,
        chapter=section.chapter,
        chapter_title=section.chapter_title,
        title=section.title,
        text=draft.text,
        fact_ids=cited,
        attempts=attempt,
        unresolved_issues=issues,
    )
    return done, canon


def absorb_new_facts(
    team: Team, canon: Canon, section: Section, text: str, events: EventLog, store: CanonStore
) -> Canon:
    editor = team("canon_editor")
    new = agents.extract_new_facts(editor, canon, section, text)
    if not new:
        return canon
    used = canon.usage_of(section.id)
    canon = canon.with_new_facts(section.id, new)
    store.save(canon)
    canon = canon.with_usage(section.id, [*used, *(f.id for f in new)])
    store.save(canon)
    events.emit(
        Event("canon_editor", editor.provider.model, "canon_update", "; ".join(f.render() for f in new), section.id)
    )
    return canon

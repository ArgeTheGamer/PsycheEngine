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
    chapter: int
    chapter_title: str
    title: str
    text: str
    fact_ids: list[str]
    attempts: int
    unresolved_issues: list[agents.Issue]


@dataclass
class Settings:
    chapters: int = 14
    max_attempts: int = 3
    language: str = "English"
    words_per_section: int = 450
    only_chapters: int | None = None  # generate just the first N chapters of the plan (live demo)


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


def run(brief: str, canon: Canon, out: Path, settings: Settings, team: Team | None = None) -> list[AcceptedSection]:
    out.mkdir(parents=True, exist_ok=True)
    store = CanonStore(out / "canon")
    events = EventLog(out / "events.jsonl")
    team = team or Team(Budget(budget_usd()), Tracer(out / "calls.jsonl"))
    store.save(canon)

    planner = team("planner")
    sections = agents.plan(planner, brief, canon, settings.chapters)
    (out / "plan.json").write_text(json.dumps([s.model_dump() for s in sections], indent=2), encoding="utf-8")
    events.emit(Event("planner", planner.provider.model, "plan", f"{len(sections)} sections in {settings.chapters} chapters"))

    if settings.only_chapters:
        sections = [s for s in sections if s.chapter <= settings.only_chapters]
    contents = agents.toc(sections)

    accepted: list[AcceptedSection] = []
    for section in sections:
        done, canon = write_section(team, canon, section, contents, settings, events)
        store.save(canon)
        canon = absorb_new_facts(team, canon, section, done.text, events)
        store.save(canon)
        accepted.append(done)
        (out / "sections.json").write_text(
            json.dumps([a.model_dump() for a in accepted], indent=2, ensure_ascii=False), encoding="utf-8"
        )
    return accepted


def write_section(
    team: Team, canon: Canon, section: Section, contents: str, settings: Settings, events: EventLog
) -> tuple[AcceptedSection, Canon]:
    writer, critic = team("writer"), team("critic")
    issues: list[agents.Issue] = []
    for attempt in range(1, settings.max_attempts + 1):
        draft = agents.write(
            writer, canon, section, contents, settings.language, settings.words_per_section, issues or None
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
        chapter=section.chapter,
        chapter_title=section.chapter_title,
        title=section.title,
        text=draft.text,
        fact_ids=cited,
        attempts=attempt,
        unresolved_issues=issues,
    )
    return done, canon


def absorb_new_facts(team: Team, canon: Canon, section: Section, text: str, events: EventLog) -> Canon:
    editor = team("canon_editor")
    new = agents.extract_new_facts(editor, canon, section, text)
    if not new:
        return canon
    canon = canon.with_new_facts(section.id, new).with_usage(
        section.id, [*canon.usage_of(section.id), *(f.id for f in new)]
    )
    events.emit(
        Event("canon_editor", editor.provider.model, "canon_update", "; ".join(f.render() for f in new), section.id)
    )
    return canon

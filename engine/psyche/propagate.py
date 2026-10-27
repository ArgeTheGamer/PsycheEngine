"""Change one canon fact and rewrite only the sections that depend on it.

The fact -> sections map in the canon says exactly which sections to touch.
Each one is revised by the writer (keeping everything else) and must pass the
critic again against the updated canon. Output: runs/<run>/changes/<n>/
    change.json      the fact change and affected section ids
    sections.json    the full manual after the change
    diff.json        before/after text of every rewritten section
    events.jsonl     agent log of the propagation
"""

from __future__ import annotations

import json
from pathlib import Path

from . import agents
from .agents import Section
from .canon import CanonStore
from .engine import AcceptedSection, EventLog, Settings, Team, write_section


def propagate(
    run_dir: Path, fact_id: str, new_value: str, new_statement: str, team: Team, settings: Settings
) -> Path:
    store = CanonStore(run_dir / "canon")
    canon = store.latest()
    plan = {s["id"]: Section(**s) for s in json.loads((run_dir / "plan.json").read_text(encoding="utf-8"))}

    # Changes stack: each one starts from the documents as the previous change left them.
    changes = run_dir / "changes"
    previous = sorted(changes.glob("*/sections.json")) if changes.exists() else []
    current_file = previous[-1] if previous else run_dir / "sections.json"
    sections = [AcceptedSection(**s) for s in json.loads(current_file.read_text(encoding="utf-8"))]
    n = len(list(changes.glob("*"))) + 1 if changes.exists() else 1
    out = changes / f"{n:02d}"
    out.mkdir(parents=True)
    events = EventLog(out / "events.jsonl")

    canon, change = canon.with_change(fact_id, new_value, new_statement)
    store.save(canon)
    (out / "change.json").write_text(change.model_dump_json(indent=2), encoding="utf-8")

    # Knock-on changes of derived facts (computed in code) are spelled out for the writer.
    knock_on = "".join(
        f"\nAs a result, {d.fact_id} changed from {d.old_value} to {d.new_value}: {canon.fact(d.fact_id).statement}"
        for d in change.derived
    ) + "".join(f"
Also updated: {canon.fact(q).statement}" for q in change.quoting)
    diff = []
    for i, current in enumerate(sections):
        if current.id not in change.affected_sections:
            continue
        revision = (
            f"\nThis section was already written and approved. The company has changed one fact: {fact_id} "
            f"was {change.old_value}, it is now: {new_statement}{knock_on}\nRevise the section below so it is "
            "consistent with the canon. Change only what these changes require and keep all other wording."
            f"\n<current_section>\n{current.text}\n</current_section>\n"
        )
        contents = agents.toc([plan[s.id] for s in sections if s.doc == current.doc])
        done, canon = write_section(team, canon, plan[current.id], contents, settings, events, revision)
        store.save(canon)
        diff.append({"section_id": current.id, "title": current.title, "before": current.text, "after": done.text})
        sections[i] = done

    (out / "sections.json").write_text(
        json.dumps([s.model_dump() for s in sections], indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (out / "diff.json").write_text(json.dumps(diff, indent=2, ensure_ascii=False), encoding="utf-8")
    return out

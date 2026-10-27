"""Change one canon fact and rewrite only the sections that depend on it.

The fact -> sections map in the canon says exactly which sections to touch.
Each one is revised by the writer (keeping everything else) and must pass the
critic again against the updated canon. Output: runs/<run>/changes/<n>/
    change.json      the fact change and affected section ids
    sections.json    the full manual after the change
    diff.json        before/after text of every rewritten section
    events.jsonl     agent log of the propagation
    notices.json     client notice and staff memo about the change, critic-checked
"""

from __future__ import annotations

import json
from pathlib import Path

from . import agents
from .agents import Section
from .canon import CanonStore
from .engine import AcceptedSection, Event, EventLog, Settings, Team, write_section
from .notices import write_notices
from .stale import find_stale, replace_stale


def propagate(
    run_dir: Path,
    fact_id: str,
    new_value: str,
    new_statement: str,
    team: Team,
    settings: Settings,
    notices: bool = True,
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
    ) + "".join(f"\nAlso updated: {canon.fact(q).statement}" for q in change.quoting)
    old_values = [(fact_id, change.old_value, canon.fact(fact_id).unit)] + [
        (d.fact_id, d.old_value, canon.fact(d.fact_id).unit) for d in change.derived
    ]
    new_values = {fact_id: change.new_value, **{d.fact_id: d.new_value for d in change.derived}}

    def revision(text: str, leftovers: str = "") -> str:
        return (
            f"\nThis section was already written and approved. The company has changed one fact: {fact_id} "
            f"was {change.old_value}, it is now: {new_statement}{knock_on}\nRevise the section below so it is "
            "consistent with the canon. Change only what these changes require and keep all other wording."
            f"{leftovers}\n<current_section>\n{text}\n</current_section>\n"
        )

    diff = []
    for i, current in enumerate(sections):
        if current.id not in change.affected_sections:
            continue
        contents = agents.toc([plan[s.id] for s in sections if s.doc == current.doc])
        done, canon = write_section(team, canon, plan[current.id], contents, settings, events, revision(current.text))
        store.save(canon)
        # Stale guard: the engine knows every old value exactly, so code (not a model) checks the revision
        # for leftovers and sends the section back with the offending words. The critic can miss these.
        for _ in range(settings.max_attempts - 1):
            hits = find_stale(done.text, old_values)
            if not hits:
                break
            for fid, match in hits:
                events.emit(Event("stale_guard", "code", "verdict", f"old value of {fid} still in text", current.id,
                                  accepted=False, quote=match))
            leftovers = "\nThese old values are still in the text and must be replaced with the canon values:\n" + "\n".join(
                f'- "{match}" (old value of {fid})' for fid, match in hits
            )
            done, canon = write_section(team, canon, plan[current.id], contents, settings, events,
                                        revision(done.text, leftovers))
            store.save(canon)
        # Last resort: the model kept an old value through every retry (seen with phrasings like "never split
        # a 1000 kg pallet"). The engine knows the exact old -> new mapping, so it substitutes in code.
        hits = find_stale(done.text, old_values)
        if hits:
            done = done.model_copy(update={"text": replace_stale(done.text, old_values, new_values)})
            for fid, match in hits:
                events.emit(Event("stale_guard", "code", "canon_update", f"replaced old value of {fid} in code", current.id,
                                  quote=match))
        diff.append({"section_id": current.id, "title": current.title, "before": current.text, "after": done.text})
        sections[i] = done

    (out / "sections.json").write_text(
        json.dumps([s.model_dump() for s in sections], indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (out / "diff.json").write_text(json.dumps(diff, indent=2, ensure_ascii=False), encoding="utf-8")
    if notices:
        rewritten = [s for s in sections if s.id in {d["section_id"] for d in diff}]
        written = write_notices(team, canon, change, rewritten, events)
        (out / "notices.json").write_text(
            json.dumps([n.model_dump() for n in written], indent=2, ensure_ascii=False), encoding="utf-8"
        )
    return out

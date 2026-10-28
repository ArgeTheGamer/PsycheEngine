"""Mutation benchmark: apply a series of fact changes to finished documents, the way a real site evolves.

    engine/.venv/Scripts/python engine/scripts/mutate.py --run md-v2 [--baseline shared] [--audit]

PsycheEngine applies each change through the canon (derived facts recomputed in
code, only dependent sections rewritten, every rewrite checked by the critic).
With --per-doc-baseline a second baseline is updated document by document, the way
each document's owner would do it. The main baseline makes one long-context request per change: it gets the owner's
brief, all current documents and the change notice, and returns the sections it
decides to update (no conversation history between changes).

After every change both versions are scanned for stale values: any earlier value
of a changed fact (including derived ones) still written with its unit. This
check is deterministic. --audit additionally runs the full auditor on the final
documents against the final truth.
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
from pathlib import Path

from pydantic import BaseModel

from psyche.agents import prompt
from psyche.audit import audit
from psyche.baseline import render_manual
from psyche.canon import Canon, load_spec
from psyche.config import REPO_ROOT, budget_usd
from psyche.engine import AcceptedSection, Settings, Team
from psyche.llm import Budget, Tracer
from psyche.propagate import propagate
from psyche.stale import value_pattern


class SectionUpdate(BaseModel):
    section_id: str
    text: str


class Updates(BaseModel):
    sections: list[SectionUpdate]


def stale_hits(sections: list[AcceptedSection], history: dict[str, list[str]], canon: Canon) -> list[dict]:
    hits = []
    for fact_id, old_values in history.items():
        unit = canon.fact(fact_id).unit
        for old in old_values:
            rx = value_pattern(old, unit)
            for s in sections:
                for m in rx.finditer(s.text):
                    hits.append({"fact_id": fact_id, "old": old, "section_id": s.id, "match": m.group(0)})
    return hits


def changed_chars(before: list[AcceptedSection], after: list[AcceptedSection]) -> tuple[int, int]:
    old = {s.id: s.text for s in before}
    sections, chars = 0, 0
    for s in after:
        if old.get(s.id) != s.text:
            sections += 1
            sm = difflib.SequenceMatcher(None, old.get(s.id, ""), s.text, autojunk=False)
            chars += sum(max(i2 - i1, j2 - j1) for tag, i1, i2, j1, j2 in sm.get_opcodes() if tag != "equal")
    return sections, chars


def update_baseline(updater, company: str, brief: str, docs: list[AcceptedSection], notice: str, n: int,
                    per_doc: bool) -> tuple[list[AcceptedSection], list[str]]:
    """One long-context request with every document, or one request per document (its owner updates it)."""
    groups = [[s for s in docs if s.doc == d] for d in dict.fromkeys(s.doc for s in docs)] if per_doc else [docs]
    by_id: dict[str, str] = {}
    for group in groups:
        updates = updater.structured(
            agent="baseline",
            messages=[{"role": "user", "content": prompt(
                "baseline_update", company=company, brief=brief, documents=render_manual(group), notice=notice)}],
            schema=Updates,
            reasoning_effort="low",
            tags={"mutation": n, "doc": group[0].doc if per_doc else "all"},
        )
        by_id.update({u.section_id: u.text for u in updates.sections})
    known = {s.id for s in docs}
    return [s.model_copy(update={"text": by_id[s.id]}) if s.id in by_id else s for s in docs], [i for i in by_id if i not in known]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", required=True)
    parser.add_argument("--baseline", default="shared", help="baseline variant whose documents get the changes")
    parser.add_argument("--per-doc-baseline", default=None,
                        help="also run a second baseline (this variant) where each document is updated on its own")
    parser.add_argument("--mutations", default="data/company/mutations.json")
    parser.add_argument("--audit", action="store_true", help="also audit the final documents (costs ~$3 per version)")
    args = parser.parse_args()

    run_dir = REPO_ROOT / "runs" / args.run
    if (run_dir / "changes").exists():
        # propagate() stacks on disk; a second pass would start the engine from mutated documents
        # while the baseline restarts from the originals. Always mutate a fresh copy of the run.
        print(f"{run_dir} already has fact changes; copy the original run to a new name and mutate that")
        return 1
    company = REPO_ROOT / "data" / "company"
    brief = (company / "brief.md").read_text(encoding="utf-8")
    mutations = json.loads((REPO_ROOT / args.mutations).read_text(encoding="utf-8"))
    truth = Canon.from_spec(load_spec(company / "company.json"))

    load = lambda p: [AcceptedSection(**s) for s in json.loads(p.read_text(encoding="utf-8"))]  # noqa: E731
    engine_docs = load(run_dir / "sections.json")
    eng_team = Team(Budget(budget_usd()), Tracer(run_dir / "calls_mutations_engine.jsonl"))

    baselines = {"baseline": (args.baseline, False)}
    if args.per_doc_baseline:
        baselines["baseline_per_doc"] = (args.per_doc_baseline, True)
    state = {}
    for key, (variant, per_doc) in baselines.items():
        out_dir = run_dir / f"mutations_{key}_{variant}"
        out_dir.mkdir(exist_ok=True)
        team = Team(Budget(budget_usd()), Tracer(out_dir / "calls.jsonl"))
        state[key] = {"dir": out_dir, "team": team, "updater": team("baseline"), "per_doc": per_doc,
                      "docs": load(run_dir / f"baseline_{variant}" / "sections.json")}

    history: dict[str, list[str]] = {}
    steps = []
    for n, m in enumerate(mutations, 1):
        batch = m["facts"] if "facts" in m else [m]
        changes = [(f["fact"], f["value"], f["statement"]) for f in batch]
        truth, change = truth.with_changes(changes)
        moved = [change, *change.also, *change.derived]
        for c in moved:
            history.setdefault(c.fact_id, []).append(c.old_value)

        spent = eng_team.budget.spent_usd
        # Notices are a product feature the baseline does not have; keep them out of the comparison.
        out = propagate(run_dir, *changes[0], eng_team, Settings(), notices=False, extra=changes[1:])
        new_engine = load(out / "sections.json")
        eng_changed = changed_chars(engine_docs, new_engine)
        eng_cost = eng_team.budget.spent_usd - spent
        engine_docs = new_engine

        step = {
            "step": n,
            "fact": batch[0]["fact"],
            "facts": [c[0] for c in changes],
            "notice": m["notice"],
            "derived": [d.model_dump() for d in change.derived],
            "engine": {"sections_changed": eng_changed[0], "chars_changed": eng_changed[1], "cost_usd": round(eng_cost, 4),
                       "stale": stale_hits(engine_docs, history, truth)},
        }
        line = f"{n}. {'+'.join(c[0] for c in changes)} (+{len(change.derived)} derived) | engine: {eng_changed[0]} sections, stale {len(step['engine']['stale'])}, ${eng_cost:.3f}"
        for key, s in state.items():
            spent = s["team"].budget.spent_usd
            new_docs, unknown = update_baseline(s["updater"], truth.company.name, brief, s["docs"], m["notice"], n, s["per_doc"])
            changed = changed_chars(s["docs"], new_docs)
            s["docs"] = new_docs
            (s["dir"] / f"{n:02d}.json").write_text(
                json.dumps([x.model_dump() for x in new_docs], indent=2, ensure_ascii=False), encoding="utf-8")
            step[key] = {"sections_changed": changed[0], "chars_changed": changed[1],
                         "cost_usd": round(s["team"].budget.spent_usd - spent, 4),
                         "stale": stale_hits(new_docs, history, truth), "unknown_ids": unknown}
            line += f" | {key}: {changed[0]} sections, stale {len(step[key]['stale'])}, ${step[key]['cost_usd']:.3f}"
        steps.append(step)
        print(line)

    result = {"baseline_variant": args.baseline, "per_doc_baseline_variant": args.per_doc_baseline, "steps": steps}
    if args.audit:
        auditor = Team(Budget(budget_usd()), Tracer(run_dir / "calls_mutations_audit.jsonl"))("auditor")
        result["final_audit"] = {"engine": audit(auditor, "engine_final", engine_docs, truth).model_dump()}
        for key, s in state.items():
            result["final_audit"][key] = audit(auditor, f"{key}_final", s["docs"], truth).model_dump()
        for k, a in result["final_audit"].items():
            print(f"final {k}: within={sum(a['within'].values())} between={sum(a['between'].values())} "
                  f"violations={len(a['violations'])}")
    (run_dir / "mutation_benchmark.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())

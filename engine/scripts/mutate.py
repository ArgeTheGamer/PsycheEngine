"""Mutation benchmark: apply a series of fact changes to finished documents, the way a real site evolves.

    engine/.venv/Scripts/python engine/scripts/mutate.py --run md-v2 [--baseline shared] [--audit]

PsycheEngine applies each change through the canon (derived facts recomputed in
code, only dependent sections rewritten, every rewrite checked by the critic).
The baseline is one long chat: it gets all current documents plus the owner's
change notice and returns the sections it decides to update.

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


class SectionUpdate(BaseModel):
    section_id: str
    text: str


class Updates(BaseModel):
    sections: list[SectionUpdate]


def value_pattern(value: str, unit: str) -> re.Pattern[str]:
    """Regex for a value written with its unit, tolerant to thousands separators and common phrasings."""
    digits = re.escape(value)
    if len(value) > 3 and value.isdigit():
        digits = re.escape(value[:-3]) + r"[,\s.]?" + re.escape(value[-3:])
    num = rf"(?<![\d.,]){digits}(?![\d.,]\d)"
    unit_rx = {
        "kg": r"\s*kg\b",
        "km/h": r"\s*km/h",
        "EUR": r"\s*(EUR|euro)",
        "pallets": r"\s+(full[- ]weight\s+|full\s+)?pallets?\b",
        "loads": r"\s+(trailer\s+)?loads?\b",
    }.get(unit, r"\s*" + re.escape(unit))
    if unit == "EUR":
        return re.compile(rf"({num}{unit_rx}|(EUR|€)\s*{digits}(?![\d.,]\d))", re.IGNORECASE)
    return re.compile(num + unit_rx, re.IGNORECASE)


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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", required=True)
    parser.add_argument("--baseline", default="shared", help="baseline variant whose documents get the changes")
    parser.add_argument("--mutations", default="data/company/mutations.json")
    parser.add_argument("--audit", action="store_true", help="also audit the final documents (costs ~$3)")
    args = parser.parse_args()

    run_dir = REPO_ROOT / "runs" / args.run
    company = REPO_ROOT / "data" / "company"
    brief = (company / "brief.md").read_text(encoding="utf-8")
    mutations = json.loads((REPO_ROOT / args.mutations).read_text(encoding="utf-8"))
    truth = Canon.from_spec(load_spec(company / "company.json"))

    load = lambda p: [AcceptedSection(**s) for s in json.loads(p.read_text(encoding="utf-8"))]  # noqa: E731
    engine_docs = load(run_dir / "sections.json")
    base_dir = run_dir / f"mutations_baseline_{args.baseline}"
    base_dir.mkdir(exist_ok=True)
    base_docs = load(run_dir / f"baseline_{args.baseline}" / "sections.json")

    eng_tracer, base_tracer = Tracer(run_dir / "calls_mutations_engine.jsonl"), Tracer(base_dir / "calls.jsonl")
    eng_team = Team(Budget(budget_usd()), eng_tracer)
    base_team = Team(Budget(budget_usd()), base_tracer)
    updater = base_team("baseline")

    history: dict[str, list[str]] = {}
    steps = []
    for n, m in enumerate(mutations, 1):
        truth, change = truth.with_change(m["fact"], m["value"], m["statement"])
        for fact_id, old in [(change.fact_id, change.old_value)] + [(d.fact_id, d.old_value) for d in change.derived]:
            history.setdefault(fact_id, []).append(old)

        spent = eng_team.budget.spent_usd
        out = propagate(run_dir, m["fact"], m["value"], m["statement"], eng_team, Settings())
        new_engine = load(out / "sections.json")
        eng_changed = changed_chars(engine_docs, new_engine)
        eng_cost = eng_team.budget.spent_usd - spent
        engine_docs = new_engine

        spent = base_team.budget.spent_usd
        updates = updater.structured(
            agent="baseline",
            messages=[{"role": "user", "content": prompt(
                "baseline_update", company=truth.company.name, brief=brief,
                documents=render_manual(base_docs), notice=m["notice"])}],
            schema=Updates,
            reasoning_effort="low",
            tags={"mutation": n},
        )
        by_id = {u.section_id: u.text for u in updates.sections}
        new_base = [s.model_copy(update={"text": by_id[s.id]}) if s.id in by_id else s for s in base_docs]
        base_changed = changed_chars(base_docs, new_base)
        base_cost = base_team.budget.spent_usd - spent
        base_docs = new_base
        (base_dir / f"{n:02d}.json").write_text(
            json.dumps([s.model_dump() for s in base_docs], indent=2, ensure_ascii=False), encoding="utf-8")

        step = {
            "step": n,
            "fact": m["fact"],
            "notice": m["notice"],
            "derived": [d.model_dump() for d in change.derived],
            "engine": {"sections_changed": eng_changed[0], "chars_changed": eng_changed[1], "cost_usd": round(eng_cost, 4),
                       "stale": stale_hits(engine_docs, history, truth)},
            "baseline": {"sections_changed": base_changed[0], "chars_changed": base_changed[1], "cost_usd": round(base_cost, 4),
                         "stale": stale_hits(base_docs, history, truth),
                         "unknown_ids": [i for i in by_id if i not in {s.id for s in base_docs}]},
        }
        steps.append(step)
        print(f"{n}. {m['fact']} -> {m['value']} (+{len(change.derived)} derived) | "
              f"engine: {eng_changed[0]} sections, stale {len(step['engine']['stale'])}, ${eng_cost:.3f} | "
              f"baseline: {base_changed[0]} sections, stale {len(step['baseline']['stale'])}, ${base_cost:.3f}")

    result = {"baseline_variant": args.baseline, "steps": steps}
    if args.audit:
        auditor = Team(Budget(budget_usd()), Tracer(run_dir / "calls_mutations_audit.jsonl"))("auditor")
        result["final_audit"] = {
            "engine": audit(auditor, "engine_final", engine_docs, truth).model_dump(),
            "baseline": audit(auditor, "baseline_final", base_docs, truth).model_dump(),
        }
        for k, a in result["final_audit"].items():
            print(f"final {k}: within={sum(a['within'].values())} between={sum(a['between'].values())} "
                  f"violations={len(a['violations'])}")
    (run_dir / "mutation_benchmark.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())

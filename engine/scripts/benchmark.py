"""Baseline generation and audit of both manuals for an engine run.

    engine/.venv/Scripts/python engine/scripts/benchmark.py baseline --run demo [--variant separate|shared] [--with-facts]
    engine/.venv/Scripts/python engine/scripts/benchmark.py audit --run demo

The baseline reuses runs/<run>/plan.json, so both manuals share the table of
contents, section purposes and length. Results go to runs/<run>/baseline_<variant>/
and runs/<run>/audit_<label>.json.
"""

from __future__ import annotations

import argparse
import json
import sys

from psyche.agents import Section
from psyche.audit import audit
from psyche.baseline import run_baseline
from psyche.canon import Canon, load_spec
from psyche.config import REPO_ROOT, budget_usd
from psyche.engine import AcceptedSection, Settings, Team
from psyche.llm import Budget, BudgetExceeded, Tracer


def load_sections(path) -> list[AcceptedSection]:
    return [AcceptedSection(**s) for s in json.loads(path.read_text(encoding="utf-8"))]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["baseline", "audit"])
    parser.add_argument("--run", required=True)
    parser.add_argument("--variant", choices=["separate", "shared"], default="separate",
                        help="each document in its own session, or every document sees all earlier ones")
    parser.add_argument("--with-facts", action="store_true", help="also give the baseline the structured fact list")
    parser.add_argument("--only-chapters", type=int, default=None)
    parser.add_argument("--language", default="English")
    parser.add_argument("--words", type=int, default=450)
    args = parser.parse_args()

    run_dir = REPO_ROOT / "runs" / args.run
    company = REPO_ROOT / "data" / "company"
    facts = Canon.from_spec(load_spec(company / "company.json"))
    variant = args.variant + ("_facts" if args.with_facts else "")
    calls = f"calls_baseline_{variant}.jsonl" if args.command == "baseline" else "calls_audit.jsonl"
    tracer = Tracer(run_dir / calls)
    team = Team(Budget(budget_usd()), tracer)

    try:
        if args.command == "baseline":
            plan = [Section(**s) for s in json.loads((run_dir / "plan.json").read_text(encoding="utf-8"))]
            settings = Settings(only_chapters=args.only_chapters, language=args.language, words_per_section=args.words)
            brief = (company / "brief.md").read_text(encoding="utf-8")
            out = run_dir / f"baseline_{variant}"
            written = run_baseline(
                brief, facts, plan, out, settings, team, with_facts=args.with_facts, shared_context=args.variant == "shared"
            )
            print(f"baseline ({variant}): {len(written)} sections")
        else:
            targets = [("engine", run_dir / "sections.json")] + [
                (d.name, d / "sections.json") for d in sorted(run_dir.glob("baseline_*")) if d.is_dir()
            ]
            for label, path in [(label, path) for label, path in targets if path.exists()]:
                result = audit(team("auditor"), label, load_sections(path), facts)
                (run_dir / f"audit_{label}.json").write_text(result.model_dump_json(indent=2), encoding="utf-8")
                print(
                    f"{label:24s} within={sum(result.within.values())} {result.within} "
                    f"between={sum(result.between.values())} {result.between} "
                    f"violations={len(result.violations)} discarded={result.discarded}"
                )
    except BudgetExceeded as e:
        print(f"stopped: {e}")
        return 2
    finally:
        print(f"spent ${team.budget.spent_usd:.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

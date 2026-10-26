"""Baseline generation and audit of both manuals for an engine run.

    engine/.venv/Scripts/python engine/scripts/benchmark.py baseline --run demo [--variant brief|facts]
    engine/.venv/Scripts/python engine/scripts/benchmark.py audit --run demo

The baseline reuses runs/<run>/plan.json, so both manuals share the table of
contents, section purposes and length. Results go to runs/<run>/baseline_{brief,facts}/
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
    parser.add_argument("--variant", choices=["brief", "facts"], default="brief",
                        help="baseline gets the owner's brief only, or the brief plus the structured fact list")
    parser.add_argument("--only-chapters", type=int, default=None)
    parser.add_argument("--language", default="English")
    parser.add_argument("--words", type=int, default=450)
    args = parser.parse_args()

    run_dir = REPO_ROOT / "runs" / args.run
    company = REPO_ROOT / "data" / "company"
    facts = Canon.from_spec(load_spec(company / "company.json"))
    calls = f"calls_baseline_{args.variant}.jsonl" if args.command == "baseline" else "calls_audit.jsonl"
    tracer = Tracer(run_dir / calls)
    team = Team(Budget(budget_usd()), tracer)

    try:
        if args.command == "baseline":
            plan = [Section(**s) for s in json.loads((run_dir / "plan.json").read_text(encoding="utf-8"))]
            settings = Settings(only_chapters=args.only_chapters, language=args.language, words_per_section=args.words)
            brief = (company / "brief.md").read_text(encoding="utf-8")
            out = run_dir / f"baseline_{args.variant}"
            written = run_baseline(brief, facts, plan, out, settings, team, with_facts=args.variant == "facts")
            print(f"baseline ({args.variant}): {len(written)} sections")
        else:
            targets = [("engine", run_dir / "sections.json")] + [
                (f"baseline_{v}", run_dir / f"baseline_{v}" / "sections.json") for v in ("brief", "facts")
            ]
            for label, path in [(label, path) for label, path in targets if path.exists()]:
                result = audit(team("auditor"), label, load_sections(path), facts)
                (run_dir / f"audit_{label}.json").write_text(result.model_dump_json(indent=2), encoding="utf-8")
                print(
                    f"{label:9s} contradictions={len(result.contradictions)} {result.contradictions_per_chapter} "
                    f"violations={len(result.violations)} {result.violations_per_chapter} discarded={result.discarded}"
                )
    except BudgetExceeded as e:
        print(f"stopped: {e}")
        return 2
    finally:
        print(f"spent ${team.budget.spent_usd:.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

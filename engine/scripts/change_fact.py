"""Change one fact in a finished run and rewrite only the dependent sections.

    engine/.venv/Scripts/python engine/scripts/change_fact.py --run demo --fact F-LIM-01 --value 8 \
        --statement "Forklifts must not exceed 8 km/h inside the building."
"""

from __future__ import annotations

import argparse
import json
import sys

from psyche.config import REPO_ROOT, budget_usd
from psyche.engine import Settings, Team
from psyche.llm import Budget, Tracer
from psyche.propagate import propagate


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", required=True)
    parser.add_argument("--fact", required=True)
    parser.add_argument("--value", required=True)
    parser.add_argument("--statement", required=True)
    args = parser.parse_args()

    run_dir = REPO_ROOT / "runs" / args.run
    tracer = Tracer(run_dir / "calls_changes.jsonl")
    team = Team(Budget(budget_usd()), tracer)
    out = propagate(run_dir, args.fact, args.value, args.statement, team, Settings())
    change = json.loads((out / "change.json").read_text(encoding="utf-8"))
    print(f"{args.fact}: {change['old_value']} -> {change['new_value']}")
    print(f"rewrote {len(change['affected_sections'])} sections: {', '.join(change['affected_sections'])}")
    print(f"spent ${team.budget.spent_usd:.4f} -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

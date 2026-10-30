"""Apply a change described in the manager's own words to a finished run.

    engine/.venv/Scripts/python engine/scripts/request_change.py --run demo \
        --message "We bought two more reach trucks, and the insurer now caps pallets at 850 kg."

An agent maps the message to fact changes and shows them; nothing changes until you confirm (or pass --yes).
Facts computed in code are never set directly. Then the changes go through the same propagation as
change_fact.py: dependent sections rewritten and checked by the critic, old values scanned, notices drafted.
"""

from __future__ import annotations

import argparse
import json
import sys

from psyche.agents import interpret_request
from psyche.canon import CanonStore
from psyche.config import REPO_ROOT, budget_usd
from psyche.engine import Settings, Team
from psyche.llm import Budget, Tracer
from psyche.propagate import propagate


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", required=True)
    parser.add_argument("--message", required=True, help="what changed, in plain words")
    parser.add_argument("--yes", action="store_true", help="apply without asking")
    args = parser.parse_args()

    run_dir = REPO_ROOT / "runs" / args.run
    team = Team(Budget(budget_usd()), Tracer(run_dir / "calls_changes.jsonl"))
    canon = CanonStore(run_dir / "canon").latest()
    request, refused = interpret_request(team("change_request"), canon, args.message)

    for c in request.changes:
        print(f"{c.fact_id}: {canon.fact(c.fact_id).value} -> {c.new_value}   ({c.reason})")
    for r in refused:
        print(f"skipped {r}")
    for q in request.unclear:
        print(f"question: {q}")
    if not request.changes:
        print("nothing to change")
        return 1
    if not args.yes and input("apply these changes? [y/N] ").strip().lower() != "y":
        return 1

    first, *rest = request.changes
    out = propagate(run_dir, first.fact_id, first.new_value, first.new_statement, team, Settings(),
                    extra=[(c.fact_id, c.new_value, c.new_statement) for c in rest])
    (out / "request.json").write_text(
        json.dumps({"message": args.message, **request.model_dump(), "refused": refused}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    change = json.loads((out / "change.json").read_text(encoding="utf-8"))
    print(f"rewrote {len(change['affected_sections'])} sections, spent ${team.budget.spent_usd:.4f} -> {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

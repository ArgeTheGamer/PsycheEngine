"""Draft the client notice and staff memo for every fact change already applied to a run.

    engine/.venv/Scripts/python engine/scripts/notices.py --run md-v2m

Each change is paired with the canon version saved right after it, so the
notices quote the values that were true at that point.
"""

from __future__ import annotations

import argparse
import json
import sys

from psyche.canon import CanonStore, FactChange
from psyche.config import REPO_ROOT, budget_usd
from psyche.engine import AcceptedSection, EventLog, Team
from psyche.llm import Budget, Tracer
from psyche.notices import write_notices


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", required=True)
    args = parser.parse_args()

    run_dir = REPO_ROOT / "runs" / args.run
    store = CanonStore(run_dir / "canon")
    canons = [store.load(v) for v in store.versions()]
    team = Team(Budget(budget_usd()), Tracer(run_dir / "calls_notices.jsonl"))

    for change_dir in sorted((run_dir / "changes").glob("*")):
        change = FactChange.model_validate_json((change_dir / "change.json").read_text(encoding="utf-8"))
        if (change_dir / "notices.json").exists():
            continue  # already drafted; rerunning only fills in what is missing
        # A batch (e.g. the fleet modernisation) is saved once, after its last fact changed.
        last = change.also[-1] if change.also else change
        note = f"{last.fact_id}: {last.old_value} -> {last.new_value}"
        canon = next(c for c in canons if c.note == note)
        diff_ids = {d["section_id"] for d in json.loads((change_dir / "diff.json").read_text(encoding="utf-8"))}
        sections = [AcceptedSection(**s) for s in json.loads((change_dir / "sections.json").read_text(encoding="utf-8"))]
        written = write_notices(team, canon, change, [s for s in sections if s.id in diff_ids], EventLog(change_dir / "events.jsonl"))
        (change_dir / "notices.json").write_text(json.dumps([n.model_dump() for n in written], indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"{change_dir.name} {note}: " + " | ".join(f"{n.audience}: {n.subject} (attempts {n.attempts})" for n in written))
    print(f"spent ${team.budget.spent_usd:.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Re-run the deterministic stale-value scan over a finished mutation run with the current patterns.

    engine/.venv/Scripts/python engine/scripts/rescore.py --run md-v4y --mutations data/company/mutations_year.json

Uses the document snapshots saved after every step, so no model is called. Updates the stale lists
in runs/<run>/mutation_benchmark.json and records the scan version.
"""

from __future__ import annotations

import argparse
import json
import sys

from mutate import stale_hits

from psyche.canon import Canon, load_spec
from psyche.config import REPO_ROOT
from psyche.engine import AcceptedSection

SCAN_VERSION = 3  # 2: count units allow at most two describing words; EUR/m/t no longer match inside other numbers
# 3: "4 and dock doors" (the end of a door range) is no longer read as 4 doors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", required=True)
    parser.add_argument("--mutations", default="data/company/mutations.json")
    args = parser.parse_args()

    run_dir = REPO_ROOT / "runs" / args.run
    result = json.loads((run_dir / "mutation_benchmark.json").read_text(encoding="utf-8"))
    load = lambda p: [AcceptedSection(**s) for s in json.loads(p.read_text(encoding="utf-8"))]  # noqa: E731
    snapshots = {
        "engine": lambda n: run_dir / "changes" / f"{n:02d}" / "sections.json",
        "baseline": lambda n: run_dir / f"mutations_baseline_{result['baseline_variant']}" / f"{n:02d}.json",
    }
    if result.get("per_doc_baseline_variant"):
        snapshots["baseline_per_doc"] = (
            lambda n: run_dir / f"mutations_baseline_per_doc_{result['per_doc_baseline_variant']}" / f"{n:02d}.json"
        )

    truth = Canon.from_spec(load_spec(REPO_ROOT / "data" / "company" / "company.json"))
    history: dict[str, list[str]] = {}
    for n, m in enumerate(json.loads((REPO_ROOT / args.mutations).read_text(encoding="utf-8")), 1):
        batch = m["facts"] if "facts" in m else [m]
        truth, change = truth.with_changes([(f["fact"], f["value"], f["statement"]) for f in batch])
        for c in [change, *change.also, *change.derived]:
            history.setdefault(c.fact_id, []).append(c.old_value)
        step = result["steps"][n - 1]
        for key, path in snapshots.items():
            before = len(step[key]["stale"])
            step[key]["stale"] = stale_hits(load(path(n)), history, truth)
            print(f"{n:2d} {key:17s} {before:3d} -> {len(step[key]['stale'])}")
    result["stale_scan_version"] = SCAN_VERSION
    (run_dir / "mutation_benchmark.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())

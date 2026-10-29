"""Copy the runs behind the README's numbers into results/ so anyone can check them.

    engine/.venv/Scripts/python engine/scripts/collect_results.py

runs/ holds every intermediate file and stays out of git; results/ keeps the documents, the latest
canon, the auditor's raw JSON, the mutation benchmarks and a cost summary for each published run.
"""

from __future__ import annotations

import json
import shutil
import sys
from collections import defaultdict

from psyche.canon import CanonStore
from psyche.config import REPO_ROOT

WRITING = ["md-v2", "md-v3", "md-v4"]  # four documents, three independent runs
MUTATIONS = ["md-v2h", "md-v3h", "md-v4h"]  # the same five changes on each of them
YEAR = "md-v4y"  # twelve changes, the demo run
EXTRA = {"recall": "full-v2/baseline_brief/audit_recall.json", "polish": "md-pl-hs"}


def costs(run_dir) -> dict:
    out: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for f in sorted(run_dir.glob("calls*.jsonl")):
        for line in f.read_text(encoding="utf-8").splitlines():
            r = json.loads(line)
            out[f.stem][f"{r['agent']}/{r['provider']}"] += r["cost_usd"]
    return {k: {a: round(v, 4) for a, v in d.items()} for k, d in out.items()}


def main() -> int:
    runs, dst_root = REPO_ROOT / "runs", REPO_ROOT / "results"
    if dst_root.exists():
        shutil.rmtree(dst_root)

    def copy(src, dst):
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)

    for name in WRITING + MUTATIONS + [YEAR]:
        src, dst = runs / name, dst_root / name
        for f in ["plan.json", "documents.json", "sections.json", "mutation_benchmark.json"]:
            if (src / f).exists():
                copy(src / f, dst / f)
        for f in src.glob("audit_*.json"):
            copy(f, dst / f.name)
        for d in src.glob("baseline_*"):
            if (d / "sections.json").exists():
                copy(d / "sections.json", dst / d.name / "sections.json")
        store = CanonStore(src / "canon")
        if store.versions():
            copy(store.path(store.versions()[-1]), dst / "canon_latest.json")
        for d in sorted(src.glob("mutations_*")):  # document snapshots after every change
            for f in d.glob("[0-9][0-9].json"):
                copy(f, dst / d.name / f.name)
        for d in sorted((src / "changes").glob("*")) if (src / "changes").exists() else []:
            for f in ["change.json", "diff.json", "notices.json", "sections.json"]:
                if (d / f).exists():
                    copy(d / f, dst / "changes" / d.name / f)
        (dst / "costs.json").write_text(json.dumps(costs(src), indent=2), encoding="utf-8")

    copy(runs / EXTRA["recall"], dst_root / "auditor_recall_planted.json")
    copy(runs / EXTRA["polish"] / "sections.json", dst_root / "polish-hs" / "sections.json")
    size = sum(p.stat().st_size for p in dst_root.rglob("*") if p.is_file()) / 1e6
    print(f"results/ written: {size:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Copy a finished run into the dashboard's data folder (web/public/runs/<run>/).

    engine/.venv/Scripts/python engine/scripts/export_web.py --run full-v1 --label "Harborwick 3PL · full manual"

The dashboard reads plain JSON files, so the site can be deployed statically and
never calls a model while the jury looks at it.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

from psyche.canon import CanonStore
from psyche.config import REPO_ROOT


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def write(path: Path, data: object) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", required=True)
    parser.add_argument("--label", required=True)
    parser.add_argument("--baseline", default="separate",
                        help="which baseline variant the dashboard shows")
    parser.add_argument("--out", default=str(REPO_ROOT / "web" / "public" / "runs"))
    args = parser.parse_args()

    src = REPO_ROOT / "runs" / args.run
    root = Path(args.out)
    dst = root / args.run
    dst.mkdir(parents=True, exist_ok=True)

    store = CanonStore(src / "canon")
    canons = [store.load(v) for v in store.versions()]
    write(dst / "canon.json", [c.model_dump(exclude={"company"}) for c in canons])
    write(dst / "events.json", read_jsonl(src / "events.jsonl"))
    if (src / "documents.json").exists():
        write(dst / "documents.json", [{"id": d["id"], "title": d["title"]} for d in json.loads((src / "documents.json").read_text(encoding="utf-8"))])
    write(dst / "calls_psyche.json", read_jsonl(src / "calls.jsonl"))
    write(dst / "calls_baseline.json", read_jsonl(src / f"calls_baseline_{args.baseline}.jsonl"))

    for which, sections, audit in [
        ("psyche", src / "sections.json", src / "audit_engine.json"),
        ("baseline", src / f"baseline_{args.baseline}" / "sections.json", src / f"audit_baseline_{args.baseline}.json"),
    ]:
        write(dst / f"sections_{which}.json", json.loads(sections.read_text(encoding="utf-8")) if sections.exists() else [])
        found = json.loads(audit.read_text(encoding="utf-8")) if audit.exists() else {"contradictions": [], "violations": []}
        write(dst / f"contradictions_{which}.json", [{"id": f"C-{i:02d}", **c} for i, c in enumerate(found["contradictions"], 1)])
        write(dst / f"audit_{which}.json", found)

    changes = sorted((src / "changes").glob("*")) if (src / "changes").exists() else []
    write(
        dst / "changes.json",
        [
            {
                "change": json.loads((c / "change.json").read_text(encoding="utf-8")),
                "diff": json.loads((c / "diff.json").read_text(encoding="utf-8")),
                "events": read_jsonl(c / "events.jsonl"),
            }
            for c in changes
            if (c / "diff.json").exists()
        ],
    )

    manifest = root / "runs.json"
    runs = json.loads(manifest.read_text(encoding="utf-8"))["runs"] if manifest.exists() else []
    runs = [r for r in runs if r["id"] != args.run]
    runs.insert(0, {"id": args.run, "label": args.label, "company": canons[0].company.name,
                    "created": dt.date.today().isoformat()})
    manifest.write_text(json.dumps({"runs": runs}, indent=2, ensure_ascii=False), encoding="utf-8")

    size = sum(p.stat().st_size for p in dst.iterdir()) / 1e6
    print(f"exported {args.run} -> {dst} ({size:.1f} MB, {len(canons)} canon versions, {len(changes)} changes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

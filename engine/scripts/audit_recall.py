"""Measure the auditor's recall: plant known contradictions and count how many it finds.

    engine/.venv/Scripts/python engine/scripts/audit_recall.py --sections runs/full-v2/baseline_brief/sections.json

Each mutation changes one value in the LAST section that mentions it, so the
manual contradicts itself between that section and earlier ones. Only the
internal-contradiction pass runs (the benchmark's headline metric).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from psyche.audit import Contradictions, audit_internal
from psyche.config import REPO_ROOT, budget_usd
from psyche.engine import AcceptedSection, Team
from psyche.llm import Budget, Tracer

MUTATIONS = [
    ("10 km/h", "12 km/h"),
    ("15 km/h", "20 km/h"),
    ("2,700 kg", "3,000 kg"),
    ("500 EUR", "300 EUR"),
    ("PR-14", "PR-16"),
    ("PR-09", "PR-11"),
    ("06:00", "07:00"),
    ("4,000 kg", "5,000 kg"),
    ("2,400", "2,600"),
    ("+2", "+4"),
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sections", required=True)
    args = parser.parse_args()

    path = REPO_ROOT / args.sections
    sections = [AcceptedSection(**s) for s in json.loads(path.read_text(encoding="utf-8"))]
    planted = []
    for old, new in MUTATIONS:
        hits = [s for s in sections if old in s.text]
        if len(hits) < 2:
            continue
        target = hits[-1]
        target.text = target.text.replace(old, new, 1)
        planted.append({"section": target.id, "old": old, "new": new})

    team = Team(Budget(budget_usd()), Tracer(path.parent / "calls_recall.jsonl"))
    found: Contradictions = audit_internal(team("auditor"), "recall", sections)
    detected = [
        p for p in planted
        if any((c.section_a == p["section"] and p["new"] in c.quote_a) or (c.section_b == p["section"] and p["new"] in c.quote_b)
               for c in found.contradictions)
    ]
    other = len(found.contradictions) - len(detected)
    result = {"planted": planted, "detected": detected, "recall": len(detected) / len(planted),
              "other_reports": other, "contradictions": [c.model_dump() for c in found.contradictions]}
    (path.parent / "audit_recall.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"planted {len(planted)}, detected {len(detected)} (recall {result['recall']:.0%}), other reports {other}")
    for p in planted:
        print(f"  {'FOUND ' if p in detected else 'missed'} {p['section']}: {p['old']} -> {p['new']}")
    print(f"spent ${team.budget.spent_usd:.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

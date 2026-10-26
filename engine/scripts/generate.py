"""Generate the company documents from one shared canon with the full agent loop.

    engine/.venv/Scripts/python engine/scripts/generate.py --run demo --only-chapters 1

Writes everything to runs/<run>/ (see psyche/engine.py for the layout).
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter

from psyche.agents import load_documents
from psyche.canon import Canon, load_spec
from psyche.config import REPO_ROOT, budget_usd
from psyche.engine import Settings, Team, run
from psyche.llm import Budget, BudgetExceeded, Tracer


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", required=True, help="run name, output goes to runs/<run>/")
    parser.add_argument("--only-chapters", type=int, default=None, help="only the first N chapters of each document")
    parser.add_argument("--resume", action="store_true", help="continue an interrupted run in place")
    parser.add_argument("--docs", default=None, help="comma-separated document ids to write (default: all)")
    parser.add_argument("--language", default="English")
    parser.add_argument("--words", type=int, default=450, help="target words per section")
    args = parser.parse_args()

    out = REPO_ROOT / "runs" / args.run
    if out.exists() and any(out.iterdir()) and not args.resume:
        print(f"{out} already exists; pick another --run name or pass --resume")
        return 1

    company = REPO_ROOT / "data" / "company"
    brief = (company / "brief.md").read_text(encoding="utf-8")
    canon = Canon.from_spec(load_spec(company / "company.json"))
    tracer = Tracer(out / "calls.jsonl")
    team = Team(Budget(budget_usd()), tracer)
    documents = load_documents(company / "documents.json")
    if args.docs:
        documents = [d for d in documents if d.id in args.docs.split(",")]
    settings = Settings(only_chapters=args.only_chapters, language=args.language, words_per_section=args.words)

    try:
        sections = run(brief, canon, out, settings, team, documents)
    except BudgetExceeded as e:
        print(f"stopped: {e}")
        return 2
    finally:
        spend = Counter()
        for r in tracer.records:
            spend[f"{r.agent} ({r.provider})"] += r.cost_usd
        for who, usd in spend.most_common():
            print(f"  {who:28s} ${usd:.4f}")
        print(f"  {'total':28s} ${team.budget.spent_usd:.4f}")

    attempts = Counter(s.attempts for s in sections)
    unresolved = sum(1 for s in sections if s.unresolved_issues)
    print(f"{len(sections)} sections -> {out}")
    print(f"attempts: {dict(sorted(attempts.items()))}, unresolved after max attempts: {unresolved}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

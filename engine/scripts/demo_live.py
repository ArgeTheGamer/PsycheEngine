"""The whole loop live, for the demo video: every Meta model call is printed as it happens.

    engine/.venv/Scripts/python engine/scripts/demo_live.py --run live-demo \
        --message "Our haulier switched to new trailers that carry 28,000 kg."

Works on a fresh copy of a finished run; the default is the published year run in results/, so it runs
from a fresh clone. Four steps:
1. The critic is shown a section with one planted wrong value and has to quote it.
2. The change agent reads the manager's message and maps it to facts.
3. Propagation: facts computed in code, only dependent sections rewritten by the writer, each checked by
   the critic and scanned by code for old values; then the client notice and the staff memo.
4. A before/after sentence and the notice, plus where the full trace is saved.
Every call is also written to runs/<run>/calls_*.jsonl and every agent step to events.jsonl.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import time

os.environ["PSYCHE_LIVE"] = "1"

from psyche import agents  # noqa: E402
from psyche.canon import Canon, CanonStore  # noqa: E402
from psyche.config import REPO_ROOT, budget_usd, provider_for  # noqa: E402
from psyche.engine import Settings, Team  # noqa: E402
from psyche.llm import Budget, Tracer, display_host  # noqa: E402
from psyche.propagate import propagate  # noqa: E402
from psyche.stale import replace_stale, value_pattern  # noqa: E402

BOLD, DIM, RESET = "\033[1m", "\033[2m", "\033[0m"


def step(n: int, title: str) -> None:
    print(f"\n{BOLD}[{n}/4] {title}{RESET}", flush=True)


def changed_sentence(before: str, after: str) -> tuple[str, str]:
    split = lambda t: [s.strip() for s in re.split(r"(?<=[.;])\s+", t) if s.strip()]  # noqa: E731
    old, new = split(before), split(after)
    gone = [s for s in old if s not in new]
    added = [s for s in new if s not in old]
    return (gone[0] if gone else ""), (added[0] if added else "")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--from", dest="source", default="results/md-v4y", help="finished run to copy (runs/ or results/)")
    parser.add_argument("--run", default="live-demo")
    parser.add_argument("--message", required=True, help="what changed, in the manager's words")
    args = parser.parse_args()

    run_dir = REPO_ROOT / "runs" / args.run
    if run_dir.exists():
        shutil.rmtree(run_dir)
    shutil.copytree(REPO_ROOT / args.source, run_dir)
    if not (run_dir / "canon").exists():  # a published run in results/ keeps only its latest canon
        CanonStore(run_dir / "canon").save(
            Canon.model_validate_json((run_dir / "canon_latest.json").read_text(encoding="utf-8")))
    team = Team(Budget(budget_usd()), Tracer(run_dir / "calls_live_demo.jsonl"))
    started = time.time()
    writer, critic = provider_for("writer"), provider_for("critic")
    print(f"{BOLD}PsycheEngine · live run{RESET}  {time.strftime('%Y-%m-%d %H:%M')}")
    print(f"writer, change agent: {writer.model} via {display_host(writer.base_url)}")
    print(f"critic: {critic.model} via {display_host(critic.base_url)}")

    canon = CanonStore(run_dir / "canon").latest()
    changes = sorted((run_dir / "changes").glob("*/sections.json"))
    sections = json.loads((changes[-1] if changes else run_dir / "sections.json").read_text(encoding="utf-8"))
    plan = {s["id"]: agents.Section(**s) for s in json.loads((run_dir / "plan.json").read_text(encoding="utf-8"))}

    step(1, "Can the critic be trusted? A planted error")
    fact = canon.fact("F-LIM-01")
    target = next(s for s in sections if value_pattern(fact.value, fact.unit).search(s["text"]))
    wrong = str(int(fact.value) + 2)
    planted = replace_stale(target["text"], [(fact.id, fact.value, fact.unit)], {fact.id: wrong})
    print(f"{DIM}planted in {target['id']}: {fact.value} {fact.unit} -> {wrong} {fact.unit}{RESET}")
    verdict = agents.critique(team("critic"), canon, plan[target["id"]], planted)
    for issue in verdict.issues:
        print(f'critic: REJECTED "{issue.quote}" ({issue.fact_id})')
    if verdict.accepted:
        print("critic: accepted (missed it)")
    (run_dir / "critic_check.json").write_text(json.dumps({
        "section": target["id"], "planted": f"{fact.value} {fact.unit} -> {wrong} {fact.unit}",
        "accepted": verdict.accepted, "issues": [i.model_dump() for i in verdict.issues],
    }, indent=2, ensure_ascii=False), encoding="utf-8")

    step(2, "The manager's message")
    print(f'"{args.message}"')
    request, refused = agents.interpret_request(team("change_request"), canon, args.message)
    for c in request.changes:
        print(f"change agent: {c.fact_id} {canon.fact(c.fact_id).value} -> {c.new_value}   ({c.reason})")
    for r in refused:
        print(f"refused by code: {r}")
    for q in request.unclear:
        print(f"question for the manager: {q}")
    if not request.changes:
        return 1

    step(3, "Propagation: rewrite only what depends on it, check every rewrite")
    first, *rest = request.changes
    out = propagate(run_dir, first.fact_id, first.new_value, first.new_statement, team, Settings(),
                    extra=[(c.fact_id, c.new_value, c.new_statement) for c in rest])
    (out / "request.json").write_text(
        json.dumps({"message": args.message, **request.model_dump(), "refused": refused}, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    step(4, "Result")
    diff = json.loads((out / "diff.json").read_text(encoding="utf-8"))
    for d in diff[:2]:
        before, after = changed_sentence(d["before"], d["after"])
        if before or after:
            print(f"{d['section_id']}\n  before: {before}\n  after:  {after}")
    notices = json.loads((out / "notices.json").read_text(encoding="utf-8"))
    for n in notices:
        print(f"\n{n['audience']}: {n['subject']}\n{DIM}{n['body'][:280]}…{RESET}")
    n_calls = len((run_dir / "calls_live_demo.jsonl").read_text(encoding="utf-8").splitlines())
    print(f"\n{BOLD}{n_calls} model calls · {len(diff)} sections rewritten · "
          f"{time.time() - started:.0f} s · ${team.budget.spent_usd:.2f}{RESET}")
    print(f"trace: {run_dir.relative_to(REPO_ROOT)}/calls_live_demo.jsonl, {out.relative_to(REPO_ROOT)}/events.jsonl")
    return 0


if __name__ == "__main__":
    sys.exit(main())

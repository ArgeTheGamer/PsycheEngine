"""Take over documents a company already has: build the canon from them, ask about conflicts, fix them.

    engine/.venv/Scripts/python engine/scripts/adopt.py --run adopt-v2 --source results/md-v2/baseline_separate \
        --plan-dir results/md-v2 --audit results/md-v2/audit_baseline_separate.json

1. The canon editor reads every section and records its checkable facts; code links each section to the
   facts whose values it states, so later changes know where to go.
2. Conflicts between passages come from the auditor (or a saved audit) and become questions for the manager,
   written to runs/<run>/answers.json. The run stops there until someone answers.
3. Answer each question with "a", "b", "ok" (not a real conflict) or the correct rule in your own words, and
   run the same command again. Each decision updates the canon, and every section that states the affected
   facts is revised by the writer and checked by the critic.
4. The auditor reads the documents again and runs/<run>/adopt.json records conflicts before and after.
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys

from psyche import agents
from psyche.audit import audit_internal
from psyche.canon import Canon, CanonStore, CompanySpec, load_spec
from psyche.config import REPO_ROOT, budget_usd
from psyche.engine import AcceptedSection, EventLog, Settings, Team, write_section
from psyche.llm import Budget, BudgetExceeded, Tracer
from psyche.stale import value_pattern


def stated_facts(canon: Canon, text: str) -> list[str]:
    """Facts whose value appears in the text with its unit: a usage link found by code, not by a model."""
    return [f.id for f in canon.facts if f.unit and value_pattern(f.value.replace(",", ""), f.unit).search(text)]


def build_canon(run_dir, sections, plan, company, team) -> tuple[Canon, list[AcceptedSection]]:
    store = CanonStore(run_dir / "canon")
    progress = run_dir / "extracted.json"
    done = json.loads(progress.read_text(encoding="utf-8")) if progress.exists() else {}
    canon = store.latest() if store.versions() else Canon.from_spec(CompanySpec(company=company, facts=[]))
    for s in sections:
        if s.id not in done:
            facts = agents.extract_new_facts(team("canon_editor"), canon, plan[s.id], s.text)
            if facts:
                canon = canon.with_new_facts(s.id, facts)
            done[s.id] = [f.id for f in facts]
            store.save(canon)
            progress.write_text(json.dumps(done, indent=2), encoding="utf-8")
    for s in sections:
        s.fact_ids = list(dict.fromkeys(done[s.id] + stated_facts(canon, s.text)))
        canon = canon.with_usage(s.id, s.fact_ids)
    store.save(canon)
    return canon, sections


def decide(conflict: dict, answer: str) -> str:
    chosen = {"a": f'"{conflict["quote_a"]}"', "b": f'"{conflict["quote_b"]}"'}.get(answer.lower(), answer)
    return (
        f"Conflict between documents ({conflict['category']}). Section {conflict['section_a']} says: "
        f"\"{conflict['quote_a']}\". Section {conflict['section_b']} says: \"{conflict['quote_b']}\". "
        f"The warehouse manager decided that the correct rule is: {chosen}"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", required=True)
    parser.add_argument("--source", required=True, help="folder with the existing documents' sections.json")
    parser.add_argument("--plan-dir", required=True, help="folder with plan.json and documents.json for those sections")
    parser.add_argument("--audit", default=None, help="saved audit of the source documents (skips a fresh audit)")
    args = parser.parse_args()

    run_dir = REPO_ROOT / "runs" / args.run
    if (run_dir / "adopt.json").exists():
        print(f"{run_dir} is already adopted; see adopt.json")  # decisions must not be applied twice
        return 1
    run_dir.mkdir(parents=True, exist_ok=True)
    for f in ["plan.json", "documents.json"]:
        shutil.copy2(REPO_ROOT / args.plan_dir / f, run_dir / f)
    plan = {s["id"]: agents.Section(**s) for s in json.loads((run_dir / "plan.json").read_text(encoding="utf-8"))}
    source = [AcceptedSection(**s) for s in json.loads((REPO_ROOT / args.source / "sections.json").read_text(encoding="utf-8"))]
    (run_dir / "sections_before.json").write_text(json.dumps([s.model_dump() for s in source], indent=2), encoding="utf-8")
    company = load_spec(REPO_ROOT / "data" / "company" / "company.json").company
    team = Team(Budget(budget_usd()), Tracer(run_dir / "calls.jsonl"))

    try:
        canon, sections = build_canon(run_dir, source, plan, company, team)
        print(f"canon: {len(canon.facts)} facts read from {len(sections)} sections")

        questions_file, answers_file = run_dir / "questions.json", run_dir / "answers.json"
        if not questions_file.exists():
            found = (json.loads((REPO_ROOT / args.audit).read_text(encoding="utf-8"))["contradictions"] if args.audit
                     else [c.model_dump() for c in audit_internal(team("auditor"), "before", sections).contradictions])
            questions = {str(i): c for i, c in enumerate(found, 1)}
            questions_file.write_text(json.dumps(questions, indent=2, ensure_ascii=False), encoding="utf-8")
        questions = json.loads(questions_file.read_text(encoding="utf-8"))
        answers = json.loads(answers_file.read_text(encoding="utf-8")) if answers_file.exists() else {}
        if not all(answers.get(n, "").strip() for n in questions):
            answers_file.write_text(json.dumps({n: answers.get(n, "") for n in questions}, indent=2), encoding="utf-8")
            for n, c in questions.items():
                print(f"\n{n}. {c['category']}\n  a) {c['section_a']}: {c['quote_a']}\n  b) {c['section_b']}: {c['quote_b']}")
            print(f"\nanswer a / b / ok / your own rule in {answers_file}, then run this again")
            return 0

        events = EventLog(run_dir / "events.jsonl")
        by_id = {s.id: s for s in sections}
        # Progress is saved after every decision, so a run stopped by the budget cap resumes without
        # applying a decision twice or losing the sections already revised.
        progress = run_dir / "decisions.json"
        saved = json.loads(progress.read_text(encoding="utf-8")) if progress.exists() else {"decisions": [], "revised": {}}
        decisions = saved["decisions"]
        by_id.update({sid: AcceptedSection(**s) for sid, s in saved["revised"].items()})

        def save_progress() -> None:
            revised = {sid: s.model_dump() for sid, s in by_id.items() if any(sid in d["rewritten"] for d in decisions)}
            progress.write_text(json.dumps({"decisions": decisions, "revised": revised}, indent=2, ensure_ascii=False),
                                encoding="utf-8")

        for n, c in questions.items():
            if any(d["question"] == n for d in decisions):
                continue
            if answers[n].strip().lower() == "ok":
                decisions.append({"question": n, "answer": "ok", "rewritten": []})
                save_progress()
                continue
            decision = decide(c, answers[n].strip())
            request, refused = agents.interpret_request(team("change_request"), canon, decision)
            changed = [r.fact_id for r in request.changes]
            if request.changes:
                canon, change = canon.with_changes([(r.fact_id, r.new_value, r.new_statement) for r in request.changes])
                targets = change.affected_sections
            else:  # the canon had no fact for this yet: record the decision as a new one
                facts = agents.extract_new_facts(team("canon_editor"), canon, plan[c["section_a"]], decision)
                canon = canon.with_new_facts(c["section_a"], facts) if facts else canon
                changed, targets = [f.id for f in facts], []
                if not facts:  # usually the canon already states the chosen rule; only the two sections change
                    print(f"{n}: no fact changed or added, the canon already agrees or the rule is not checkable")
            targets = list(dict.fromkeys([c["section_a"], c["section_b"], *targets]))
            revision = (
                "\nThis section comes from documents written before the company settled a conflict between them. "
                f"{decision}\nRevise the section below so it agrees with that decision and the canon. "
                f"Change only what the decision requires and keep all other wording.\n<current_section>\n"
            )
            for sid in [t for t in targets if t in by_id]:
                contents = agents.toc([plan[s.id] for s in sections if s.doc == by_id[sid].doc])
                done, canon = write_section(team, canon, plan[sid], contents, Settings(), events,
                                            revision + by_id[sid].text + "\n</current_section>\n")
                by_id[sid] = done
            CanonStore(run_dir / "canon").save(canon)
            decisions.append({"question": n, "answer": answers[n], "facts": changed, "refused": refused,
                              "unclear": request.unclear, "rewritten": targets})
            save_progress()
            print(f"{n}: {', '.join(changed) or 'no fact'} -> rewrote {', '.join(targets)}")

        after = [by_id[s.id] for s in sections]
        (run_dir / "sections.json").write_text(json.dumps([s.model_dump() for s in after], indent=2), encoding="utf-8")
        remaining = audit_internal(team("auditor"), "after", after).contradictions
        summary = {
            "facts": len(canon.facts),
            "conflicts_before": len(questions),
            "dismissed": sum(d["answer"] == "ok" for d in decisions),
            "conflicts_after": len(remaining),
            "sections_rewritten": len({t for d in decisions for t in d["rewritten"]}),
            "decisions": decisions,
            "remaining": [c.model_dump() for c in remaining],
        }
        (run_dir / "adopt.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"conflicts {len(questions)} -> {len(remaining)}, {summary['sections_rewritten']} sections rewritten")
    except BudgetExceeded as e:
        print(f"stopped: {e} (run again to continue)")
        return 2
    finally:
        print(f"spent ${team.budget.spent_usd:.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

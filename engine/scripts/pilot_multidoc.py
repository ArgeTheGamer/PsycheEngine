"""Pilot: do separately written company documents contradict each other?

Each document is written in its own session from the owner's brief only — the
way a small company really produces them, at different times. The operations
manual is taken from an existing baseline run. The auditor then reads all
documents together and we count contradictions BETWEEN documents.

    engine/.venv/Scripts/python engine/scripts/pilot_multidoc.py --manual runs/full-v2/baseline_brief/sections.json --out runs/pilot-multidoc
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter

from pydantic import BaseModel

from psyche.audit import audit_internal
from psyche.config import REPO_ROOT, budget_usd
from psyche.engine import AcceptedSection, Team
from psyche.llm import Budget, Tracer

DOCS = {
    "hs": ("Health and Safety Instruction",
           "the site health and safety instruction: forklift and pedestrian rules, PPE, hazardous goods, cold zone "
           "work, incident reporting and emergency procedures"),
    "roles": ("Job Descriptions",
              "job descriptions for every role on site: duties, what each role may authorise or sign off, who they "
              "report to, required licences and training"),
    "sla": ("Client Service Level Agreement",
            "the service level agreement offered to warehouse clients: receiving and dispatch times, cut-offs, order "
            "accuracy, stock counts and reporting, damaged goods and returns handling, temperature-controlled storage"),
}

PROMPT = """You work for {company}. Write {what}.

Company description from the owner:
<brief>
{brief}
</brief>

Write it as a real document of this company: concrete, specific and practical, 5-7 sections, about {words}
words in total, in English. Return the sections with a title and the text of each."""


class DocSection(BaseModel):
    title: str
    text: str


class Doc(BaseModel):
    sections: list[DocSection]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manual", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--words", type=int, default=1800)
    args = parser.parse_args()

    out = REPO_ROOT / args.out
    out.mkdir(parents=True, exist_ok=True)
    brief = (REPO_ROOT / "data" / "company" / "brief.md").read_text(encoding="utf-8")
    manual = [AcceptedSection(**s) for s in json.loads((REPO_ROOT / args.manual).read_text(encoding="utf-8"))]
    for s in manual:
        s.chapter_title = f"Operations Manual — {s.chapter_title}"

    team = Team(Budget(budget_usd()), Tracer(out / "calls.jsonl"))
    llm = team("baseline")
    docs: list[AcceptedSection] = []
    chapter = max(s.chapter for s in manual)
    for key, (name, what) in DOCS.items():
        chapter += 1
        doc = llm.structured(
            agent="baseline",
            messages=[{"role": "user", "content": PROMPT.format(company="Harborwick 3PL Ltd.", what=what, brief=brief, words=args.words)}],
            schema=Doc,
            reasoning_effort="low",
            tags={"doc": key},
        )
        for i, s in enumerate(doc.sections, 1):
            docs.append(AcceptedSection(id=f"{key}.s{i}", chapter=chapter, chapter_title=name, title=s.title,
                                        text=s.text, fact_ids=[], attempts=1, unresolved_issues=[]))
        print(f"{name}: {len(doc.sections)} sections, {sum(len(s.text.split()) for s in doc.sections)} words")

    (out / "documents.json").write_text(json.dumps([d.model_dump() for d in docs], indent=2, ensure_ascii=False), encoding="utf-8")
    found = audit_internal(team("auditor"), "multidoc", manual + docs).contradictions

    def doc_of(section_id: str) -> str:
        return section_id.split(".")[0] if not section_id.startswith("ch") else "ops"

    cross = [c for c in found if doc_of(c.section_a) != doc_of(c.section_b)]
    (out / "audit.json").write_text(json.dumps([c.model_dump() for c in found], indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"contradictions: {len(found)} total, {len(cross)} between documents")
    print("  by document pair:", dict(Counter(tuple(sorted((doc_of(c.section_a), doc_of(c.section_b)))) for c in cross)))
    print("  by category:", dict(Counter(c.category for c in cross)))
    for c in cross:
        print(f"  [{c.category}] {c.section_a}: {c.quote_a[:80]!r}  <>  {c.section_b}: {c.quote_b[:80]!r}")
    print(f"spent ${team.budget.spent_usd:.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

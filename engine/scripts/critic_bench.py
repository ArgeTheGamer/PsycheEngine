"""How good is the critic? Plant known errors in accepted sections and count how many each model catches.

    engine/.venv/Scripts/python engine/scripts/critic_bench.py --run-dir results/md-v4 --cases 10

Three kinds of error are planted in code, one per section: a wrong value of a fact the section cites
(e.g. 10 km/h -> 12 km/h), a wrong zone (Zone D -> Zone B) and a wrong procedure number (PR-08 -> PR-03).
A plant counts as caught when the critic rejects the section with a quote containing the planted text.
Untouched sections measure false alarms. Every case goes to Muse Spark Open and to Muse Spark 1.3 with
the same prompt and canon. Writes <run-dir>/critic_bench.json.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys

from psyche.agents import Section, critique, normalize
from psyche.canon import Canon
from psyche.config import REPO_ROOT, budget_usd, meta_provider, open_weights_provider
from psyche.llm import LLM, Budget, Tracer
from psyche.stale import current_values, replace_stale, value_pattern

SEED = 20261030


def wrong_number(value: str) -> str:
    x = float(value.replace(",", ""))
    bumped = x + max(1, round(x * 0.2)) if x.is_integer() else x + 0.5
    return str(int(bumped)) if float(bumped).is_integer() and "." not in value else f"{bumped:.1f}"


def plant_number(text, facts, canon, rng):
    taken = current_values(canon.facts)
    options = []
    for f in facts:
        if not f.unit or not re.fullmatch(r"[\d,]+(\.\d+)?", f.value):
            continue
        new = wrong_number(f.value)
        if (new, f.unit) in taken:
            continue
        options += [(f, m, new) for m in value_pattern(f.value, f.unit).finditer(text)]
    if not options:
        return None
    f, m, new = rng.choice(options)
    planted = replace_stale(m.group(0), [(f.id, f.value, f.unit)], {f.id: new})
    return text[: m.start()] + planted + text[m.end():], planted, f"{f.id}: {m.group(0)} -> {planted}"


def plant_token(text, facts, rx, alphabet, rng, label):
    cited = " ".join(f.statement for f in facts)
    options = [m for m in re.finditer(rx, text) if m.group(1) in cited]
    if not options:
        return None
    m = rng.choice(options)
    free = [a for a in alphabet if a not in re.findall(rx, cited) and a != m.group(1)]
    if not free:
        return None
    planted = m.group(0).replace(m.group(1), rng.choice(free))
    return text[: m.start()] + planted + text[m.end():], planted, f"{label}: {m.group(0)} -> {planted}"


def build_cases(sections, plan, canon, per_kind, rng):
    zones = list("ABCDEF")
    procedures = sorted({p for f in canon.facts for p in re.findall(r"PR-(\d\d)", f.statement)})
    planters = {
        "value": lambda t, fs: plant_number(t, fs, canon, rng),
        "zone": lambda t, fs: plant_token(t, fs, r"Zone ([A-F])\b", zones, rng, "zone"),
        "procedure": lambda t, fs: plant_token(t, fs, r"PR-(\d\d)\b", procedures, rng, "procedure"),
    }
    order = sections[:]
    rng.shuffle(order)
    used, cases = set(), []
    for kind, plant in planters.items():
        for s in order:
            if sum(c["kind"] == kind for c in cases) == per_kind:
                break
            facts = [canon.fact(i) for i in s["fact_ids"] if canon.has(i)]
            if s["id"] in used or not (result := plant(s["text"], facts)):
                continue
            text, planted, note = result
            used.add(s["id"])
            cases.append({"kind": kind, "section": s["id"], "text": text, "planted": planted, "note": note})
    for s in [s for s in order if s["id"] not in used][:per_kind]:
        cases.append({"kind": "clean", "section": s["id"], "text": s["text"], "planted": "", "note": "untouched"})
    return cases


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-dir", default="results/md-v4")
    parser.add_argument("--cases", type=int, default=10, help="cases per kind (value, zone, procedure, clean)")
    args = parser.parse_args()

    run_dir = REPO_ROOT / args.run_dir
    canon = Canon.model_validate_json((run_dir / "canon_latest.json").read_text(encoding="utf-8"))
    sections = json.loads((run_dir / "sections.json").read_text(encoding="utf-8"))
    plan = {s["id"]: Section(**s) for s in json.loads((run_dir / "plan.json").read_text(encoding="utf-8"))}
    sections = [s for s in sections if s["id"] in plan]
    cases = build_cases(sections, plan, canon, args.cases, random.Random(SEED))

    critics = {"Muse Spark Open": open_weights_provider(), "Muse Spark 1.3": meta_provider()}
    tracer = Tracer(run_dir / "calls_critic_bench.jsonl")
    for name, provider in critics.items():
        llm = LLM(provider, Budget(budget_usd()), tracer)
        for c in cases:
            verdict = critique(llm, canon, plan[c["section"]], c["text"])
            quotes = [i.quote for i in verdict.issues]
            hit = bool(c["planted"]) and any(normalize(c["planted"]) in normalize(q) for q in quotes)
            c.setdefault("results", {})[name] = {"accepted": verdict.accepted, "caught": hit, "quotes": quotes}
        print(f"{name}: ${llm.budget.spent_usd:.3f}")

    summary = {}
    for name in critics:
        row = {}
        for kind in ["value", "zone", "procedure"]:
            ks = [c for c in cases if c["kind"] == kind]
            row[kind] = f"{sum(c['results'][name]['caught'] for c in ks)}/{len(ks)}"
        clean = [c for c in cases if c["kind"] == "clean"]
        row["false_alarms"] = f"{sum(not c['results'][name]['accepted'] for c in clean)}/{len(clean)}"
        summary[name] = row
        print(name, row)
    out = {"seed": SEED, "source": args.run_dir, "summary": summary, "cases": cases}
    (run_dir / "critic_bench.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())

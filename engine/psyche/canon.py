"""The canon: versioned ground truth about the company.

Every fact has an id and the list of sections that use it. Agents read facts
from the canon, the critic checks sections against it, and the fact -> sections
map tells us exactly what to rewrite when a fact changes.
"""

from __future__ import annotations

import ast
import json
import math
import re
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

Category = Literal[
    "limit", "zone", "role", "responsibility", "procedure", "step_order", "equipment", "schedule", "rule"
]


class Fact(BaseModel):
    id: str
    category: Category
    subject: str
    attribute: str
    value: str
    unit: str = ""
    statement: str
    # "company" for facts from the input description, "section:<id>" for facts a section introduced.
    source: str = "company"
    # Derived facts carry a formula over other facts, e.g. "min(floor({F-EQP-11} / {F-LIM-15}), {F-EQP-12})".
    # Their value is always computed in code, never by a model.
    formula: str = ""
    # Facts whose value this fact's statement quotes, e.g. an approval rule that names the write-off threshold.
    refs: list[str] = Field(default_factory=list)

    def render(self) -> str:
        value = f"{self.value} {self.unit}".strip()
        return f"{self.id} | {self.subject}.{self.attribute} = {value} | {self.statement}"


class Company(BaseModel):
    name: str
    location: str
    summary: str


class CompanySpec(BaseModel):
    """Input file shape: data/company/company.json."""

    company: Company
    facts: list[Fact]


class DerivedChange(BaseModel):
    fact_id: str
    old_value: str
    new_value: str


class FactChange(BaseModel):
    fact_id: str
    old_value: str
    new_value: str
    affected_sections: list[str]  # sections using the changed fact or any derived fact whose value moved
    derived: list[DerivedChange] = Field(default_factory=list)
    quoting: list[str] = Field(default_factory=list)  # facts whose statements quote a changed value and were updated


class Canon(BaseModel):
    version: int = 1
    company: Company
    facts: list[Fact]
    # fact id -> ids of sections whose text relies on that fact
    usage: dict[str, list[str]] = Field(default_factory=dict)
    note: str = ""

    @classmethod
    def from_spec(cls, spec: CompanySpec) -> Canon:
        _reject_duplicates(spec.facts)
        canon = cls(company=spec.company, facts=spec.facts, note="seeded from company description")
        canon.recompute()
        return canon

    def recompute(self) -> list[DerivedChange]:
        """Re-evaluate every derived fact in place (formulas may build on other derived facts)."""
        changes: dict[str, DerivedChange] = {}
        for _ in range(len(self.facts)):
            moved = False
            values = {f.id: f.value for f in self.facts}
            for i, f in enumerate(self.facts):
                if not f.formula:
                    continue
                new = format_number(evaluate(f.formula, values))
                if new != f.value:
                    first = changes.get(f.id, DerivedChange(fact_id=f.id, old_value=f.value, new_value=new))
                    changes[f.id] = first.model_copy(update={"new_value": new})
                    self.facts[i] = f.model_copy(update={"value": new, "statement": replace_number(f.statement, f.value, new)})
                    values[f.id] = new
                    moved = True
            if not moved:
                break
        return [c for c in changes.values() if c.old_value != c.new_value]

    def fact(self, fact_id: str) -> Fact:
        for f in self.facts:
            if f.id == fact_id:
                return f
        raise KeyError(fact_id)

    def has(self, fact_id: str) -> bool:
        return any(f.id == fact_id for f in self.facts)

    def render(self, fact_ids: list[str] | None = None) -> str:
        """Compact text form for prompts; all facts, or only the requested ones."""
        wanted = None if fact_ids is None else set(fact_ids)
        return "\n".join(f.render() for f in self.facts if wanted is None or f.id in wanted)

    def sections_using(self, fact_id: str) -> list[str]:
        return list(self.usage.get(fact_id, []))

    def usage_of(self, section_id: str) -> list[str]:
        """Fact ids a section relies on (inverse of sections_using)."""
        return [fact_id for fact_id, sections in self.usage.items() if section_id in sections]

    # Mutations return a new canon with version + 1, so every step stays on disk.

    def next(self, note: str) -> Canon:
        return self.model_copy(deep=True, update={"version": self.version + 1, "note": note})

    def with_usage(self, section_id: str, fact_ids: list[str]) -> Canon:
        fact_ids = list(dict.fromkeys(fact_ids))  # models sometimes cite the same fact twice
        unknown = [i for i in fact_ids if not self.has(i)]
        if unknown:
            raise KeyError(f"section {section_id} cites unknown facts: {unknown}")
        canon = self.next(f"section {section_id} accepted")
        canon.usage = {k: [s for s in v if s != section_id] for k, v in canon.usage.items()}
        for fact_id in fact_ids:
            canon.usage.setdefault(fact_id, []).append(section_id)
        canon.usage = {k: v for k, v in canon.usage.items() if v}
        return canon

    def with_new_facts(self, section_id: str, facts: list[Fact]) -> Canon:
        _reject_duplicates(facts)
        clashes = [f.id for f in facts if self.has(f.id)]
        if clashes:
            raise ValueError(f"fact ids already in canon: {clashes}")
        canon = self.next(f"{len(facts)} new facts from section {section_id}")
        canon.facts.extend(f.model_copy(update={"source": f"section:{section_id}"}) for f in facts)
        canon.link_quotes()
        return canon

    def link_quotes(self) -> None:
        """Give section-introduced facts a ref to every company fact whose value they quote.

        The canon editor often restates a base value ("a 1000 kg pallet must never be split"). Without a ref
        such a fact keeps the old number after a change and feeds it back to the writer. Only values that
        identify a single company fact are linked, so two different limits that happen to share "5 km/h"
        are never tied together.
        """
        from .stale import value_pattern

        base = [f for f in self.facts if f.source == "company" and f.unit and f.value.replace(",", "").isdigit()]
        counts: dict[tuple[str, str], int] = {}
        for g in base:
            counts[(g.value, g.unit)] = counts.get((g.value, g.unit), 0) + 1
        distinct = [g for g in base if counts[(g.value, g.unit)] == 1]
        for i, f in enumerate(self.facts):
            if f.source == "company" or f.formula:
                continue
            refs = [g.id for g in distinct if g.id not in f.refs and value_pattern(g.value, g.unit).search(f.statement)]
            if refs:
                self.facts[i] = f.model_copy(update={"refs": f.refs + refs})

    def with_change(self, fact_id: str, new_value: str, new_statement: str) -> tuple[Canon, FactChange]:
        old = self.fact(fact_id)
        canon = self.next(f"{fact_id}: {old.value} -> {new_value}")
        index = next(i for i, f in enumerate(canon.facts) if f.id == fact_id)
        canon.facts[index] = old.model_copy(update={"value": new_value, "statement": new_statement})
        derived = canon.recompute()
        moved = {fact_id: (old.value, new_value), **{d.fact_id: (d.old_value, d.new_value) for d in derived}}
        quoting = []
        for i, f in enumerate(canon.facts):
            for ref in f.refs:
                if ref in moved and replace_number(f.statement, *moved[ref]) != f.statement:
                    f = f.model_copy(update={"statement": replace_number(f.statement, *moved[ref])})
                    canon.facts[i] = f
                    quoting.append(f.id)
        affected = self.sections_using(fact_id)
        for other in [d.fact_id for d in derived] + quoting:
            affected += [s for s in self.sections_using(other) if s not in affected]
        change = FactChange(
            fact_id=fact_id,
            old_value=old.value,
            new_value=new_value,
            affected_sections=affected,
            derived=derived,
            quoting=list(dict.fromkeys(quoting)),
        )
        return canon, change


class CanonStore:
    """Writes each canon version to <dir>/vNN.json so history is inspectable and replayable."""

    def __init__(self, directory: Path):
        self.directory = directory

    def path(self, version: int) -> Path:
        return self.directory / f"v{version:02d}.json"

    def save(self, canon: Canon) -> Path:
        """Write a new version; refuses to replace a different canon already saved under that number."""
        self.directory.mkdir(parents=True, exist_ok=True)
        path = self.path(canon.version)
        text = canon.model_dump_json(indent=2)
        if path.exists() and path.read_text(encoding="utf-8") != text:
            raise FileExistsError(f"{path.name} already holds a different canon; branch from the latest version")
        path.write_text(text, encoding="utf-8")
        return path

    def load(self, version: int) -> Canon:
        return Canon.model_validate_json(self.path(version).read_text(encoding="utf-8"))

    def versions(self) -> list[int]:
        return sorted(int(p.stem[1:]) for p in self.directory.glob("v*.json"))

    def latest(self) -> Canon:
        versions = self.versions()
        if not versions:
            raise FileNotFoundError(f"no canon versions in {self.directory}")
        return self.load(versions[-1])


def _reject_duplicates(facts: list[Fact]) -> None:
    ids = [f.id for f in facts]
    duplicates = sorted({i for i in ids if ids.count(i) > 1})
    if duplicates:
        raise ValueError(f"duplicate fact ids: {duplicates}")


_FUNCS = {"min": min, "max": max, "floor": math.floor, "ceil": math.ceil, "round": round}
_OPS = {
    ast.Add: lambda a, b: a + b,
    ast.Sub: lambda a, b: a - b,
    ast.Mult: lambda a, b: a * b,
    ast.Div: lambda a, b: a / b,
    ast.FloorDiv: lambda a, b: a // b,
}


def evaluate(formula: str, values: dict[str, str]) -> float:
    """Evaluate a fact formula safely: numbers, + - * / //, parentheses and min/max/floor/ceil/round only."""
    expr = re.sub(r"\{([A-Z]+-[A-Z]+-\d+)\}", lambda m: repr(_number(values[m.group(1)])), formula)

    def ev(node: ast.AST) -> float:
        if isinstance(node, ast.Expression):
            return ev(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return node.value
        if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
            return _OPS[type(node.op)](ev(node.left), ev(node.right))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in _FUNCS:
            return _FUNCS[node.func.id](*(ev(a) for a in node.args))
        raise ValueError(f"unsupported expression in formula: {formula}")

    return ev(ast.parse(expr, mode="eval"))


def _number(value: str) -> float:
    return float(value.replace(",", "").strip())


def replace_number(text: str, old: str, new: str) -> str:
    """Replace a whole number in text ("10" but not inside "100"), tolerating thousands separators."""
    digits = re.escape(old)
    if len(old) > 3 and old.isdigit():
        digits = re.escape(old[:-3]) + r"[,\s]?" + re.escape(old[-3:])
    return re.sub(rf"(?<![\d.,]){digits}(?![\d]|[.,]\d)", new, text)


def format_number(x: float) -> str:
    return str(int(x)) if float(x).is_integer() else f"{x:.2f}".rstrip("0").rstrip(".")


def load_spec(path: Path) -> CompanySpec:
    return CompanySpec.model_validate(json.loads(path.read_text(encoding="utf-8")))

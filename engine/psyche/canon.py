"""The canon: versioned ground truth about the company.

Every fact has an id and the list of sections that use it. Agents read facts
from the canon, the critic checks sections against it, and the fact -> sections
map tells us exactly what to rewrite when a fact changes.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

Category = Literal["limit", "zone", "role", "responsibility", "procedure", "step_order", "equipment", "schedule"]


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


class FactChange(BaseModel):
    fact_id: str
    old_value: str
    new_value: str
    affected_sections: list[str]


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
        return cls(company=spec.company, facts=spec.facts, note="seeded from company description")

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
        return canon

    def with_change(self, fact_id: str, new_value: str, new_statement: str) -> tuple[Canon, FactChange]:
        old = self.fact(fact_id)
        canon = self.next(f"{fact_id}: {old.value} -> {new_value}")
        index = next(i for i, f in enumerate(canon.facts) if f.id == fact_id)
        canon.facts[index] = old.model_copy(update={"value": new_value, "statement": new_statement})
        change = FactChange(
            fact_id=fact_id,
            old_value=old.value,
            new_value=new_value,
            affected_sections=self.sections_using(fact_id),
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


def load_spec(path: Path) -> CompanySpec:
    return CompanySpec.model_validate(json.loads(path.read_text(encoding="utf-8")))

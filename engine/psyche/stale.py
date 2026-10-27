"""Deterministic search for old values of changed facts.

After a fact changes, its previous value (and the previous values of facts
computed from it) must not survive anywhere in the documents. The engine knows
those values exactly, so this check is code, not a model.
"""

from __future__ import annotations

import re

_UNITS = {
    "kg": r"\s*kg\b",
    "km/h": r"\s*km/h",
    "EUR": r"\s*(EUR|euro)",
    "pallets": r"\s+(full[- ]weight\s+|full\s+)?pallets?\b",
    "loads": r"\s+(trailer\s+)?loads?\b",
}


def value_pattern(value: str, unit: str) -> re.Pattern[str]:
    """Regex for a value written with its unit, tolerant to thousands separators and common phrasings."""
    digits = re.escape(value)
    if len(value) > 3 and value.isdigit():
        digits = re.escape(value[:-3]) + r"[,\s.]?" + re.escape(value[-3:])
    num = rf"(?<![\d.,]){digits}(?![\d.,]\d)"
    unit_rx = _UNITS.get(unit, r"\s*" + re.escape(unit))
    if unit == "EUR":
        return re.compile(rf"({num}{unit_rx}|(EUR|€)\s*{digits}(?![\d.,]\d))", re.IGNORECASE)
    return re.compile(num + unit_rx, re.IGNORECASE)


def find_stale(text: str, old_values: list[tuple[str, str, str]]) -> list[tuple[str, str]]:
    """(fact_id, matched text) for every old value still present; old_values = [(fact_id, old, unit)]."""
    hits = []
    for fact_id, old, unit in old_values:
        if not unit:
            continue  # a bare number is too ambiguous to call stale
        hits += [(fact_id, m.group(0)) for m in value_pattern(old, unit).finditer(text)]
    return hits

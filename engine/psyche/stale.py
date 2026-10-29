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
    # Count units allow at most two describing words ("6 electric counterbalance forklifts") so that
    # "6 dock doors serve all trucks" is not read as six trucks, and "8 forklift operators" counts people.
    "trucks": r"\s+([\w-]+\s+){0,2}(trucks?|forklifts?|jacks?)\b(?!\s+(operators?|drivers?|licen[cs]es?))",
    "doors": r"\s+(\w+\s+)?(dock\s+)?doors?\b",
    "t": r"\s*(t|tonnes?|tons?)\b(?!/)",
    "m": r"\s*m\b(?!/)",
    "°C": r"\s*°\s*C",
}


def value_pattern(value: str, unit: str) -> re.Pattern[str]:
    """Regex for a value written with its unit, tolerant to thousands separators and common phrasings."""
    digits = re.escape(value)
    if len(value) > 3 and value.isdigit():
        digits = re.escape(value[:-3]) + r"[,\s.]?" + re.escape(value[-3:])
    num = rf"(?<![\d.,]){digits}(?![\d.,]\d)"
    unit_rx = _UNITS.get(unit, r"\s*" + re.escape(unit))
    if unit == "EUR":
        return re.compile(rf"({num}{unit_rx}|(EUR|€)\s*{digits}(?!\d)(?![.,]\d))", re.IGNORECASE)
    return re.compile(num + unit_rx, re.IGNORECASE if unit not in ("m", "t") else 0)


def current_values(facts) -> set[tuple[str, str]]:
    """(value, unit) pairs that some fact currently holds; an old value equal to one of them is ambiguous."""
    return {(f.value.replace(",", ""), f.unit) for f in facts if f.unit}


def unambiguous(old_values: list[tuple[str, str, str]], facts) -> list[tuple[str, str, str]]:
    """Drop old values that another fact still holds (e.g. stacking height 4.0 m vs aisle width 4.0 m):
    text alone cannot tell which fact a "4.0 m" refers to, so code must not flag or rewrite it."""
    taken = current_values(facts)
    return [(fid, old, unit) for fid, old, unit in old_values if (old.replace(",", ""), unit) not in taken]


def find_stale(text: str, old_values: list[tuple[str, str, str]]) -> list[tuple[str, str]]:
    """(fact_id, matched text) for every old value still present; old_values = [(fact_id, old, unit)]."""
    hits = []
    for fact_id, old, unit in old_values:
        if not unit:
            continue  # a bare number is too ambiguous to call stale
        hits += [(fact_id, m.group(0)) for m in value_pattern(old, unit).finditer(text)]
    return hits


def _number_rx(value: str) -> str:
    if len(value) > 3 and value.isdigit():
        return re.escape(value[:-3]) + r"[,\s.]?" + re.escape(value[-3:])
    return re.escape(value)


def replace_stale(text: str, old_values: list[tuple[str, str, str]], new_values: dict[str, str]) -> str:
    """Rewrite every stale value with the current one, keeping the unit and the thousands-separator style."""
    for fact_id, old, unit in old_values:
        if not unit or fact_id not in new_values:
            continue
        new = new_values[fact_id]

        def swap(m: re.Match[str]) -> str:
            styled = f"{int(new):,}" if "," in m.group(0) and new.isdigit() and len(new) > 3 else new
            return re.sub(_number_rx(old), styled, m.group(0), count=1)

        text = value_pattern(old, unit).sub(swap, text)
    return text

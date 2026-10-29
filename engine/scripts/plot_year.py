"""Draw the year-of-changes chart for the README as a plain SVG (no plotting dependency).

    engine/.venv/Scripts/python engine/scripts/plot_year.py

Reads results/md-v4y/mutation_benchmark.json and writes docs/year.svg.
"""

from __future__ import annotations

import json
import sys

from psyche.config import REPO_ROOT

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
INK, HAZARD, SOFT, RULE, BG = "#1b2330", "#e8590c", "#4a5463", "#b9beb8", "#fbfbf9"


def main() -> int:
    data = json.loads((REPO_ROOT / "results" / "md-v4y" / "mutation_benchmark.json").read_text(encoding="utf-8"))
    series = [
        ("PsycheEngine", [len(s["engine"]["stale"]) for s in data["steps"]], INK, ""),
        ("Muse Spark, every document in one context", [len(s["baseline"]["stale"]) for s in data["steps"]], HAZARD, ""),
        ("Muse Spark, each document on its own", [len(s["baseline_per_doc"]["stale"]) for s in data["steps"]], HAZARD, "6 5"),
    ]
    w, h, left, right, top, bottom = 900, 400, 60, 250, 50, 50
    pw, ph = w - left - right, h - top - bottom
    ymax = max(max(v) for _, v, _, _ in series) + 2
    x = lambda i: left + pw * i / 11  # noqa: E731
    y = lambda v: top + ph - ph * v / ymax  # noqa: E731

    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" font-family="Arial, sans-serif">',
           f'<rect width="{w}" height="{h}" fill="{BG}"/>',
           f'<text x="{left}" y="28" font-size="18" font-weight="700" fill="{INK}">Out-of-date values left in the documents, month by month</text>']
    for v in range(0, ymax + 1, 2):
        out.append(f'<line x1="{left}" x2="{left + pw}" y1="{y(v):.1f}" y2="{y(v):.1f}" stroke="{RULE}" stroke-width="1"/>')
        out.append(f'<text x="{left - 10}" y="{y(v) + 4:.1f}" font-size="12" text-anchor="end" fill="{SOFT}">{v}</text>')
    for i, m in enumerate(MONTHS):
        out.append(f'<text x="{x(i):.1f}" y="{top + ph + 22}" font-size="12" text-anchor="middle" fill="{SOFT}">{m}</text>')
    out.append(f'<rect x="{x(3.5):.1f}" y="{top}" width="{x(4.5) - x(3.5):.1f}" height="{ph}" fill="{HAZARD}" opacity="0.08"/>')
    out.append(f'<text x="{x(4):.1f}" y="{top + 14}" font-size="11" text-anchor="middle" fill="{SOFT}">fleet replaced</text>')
    for k, (name, values, color, dash) in enumerate(series):
        pts = " ".join(f"{x(i):.1f},{y(v) - (1.5 if k == 0 else 0):.1f}" for i, v in enumerate(values))
        width = 4 if k == 0 else 2.5
        dash_attr = f' stroke-dasharray="{dash}"' if dash else ""
        out.append(f'<polyline points="{pts}" fill="none" stroke="{color}" stroke-width="{width}"{dash_attr}/>')
        out.append(f'<text x="{x(11) + 10:.1f}" y="{y(values[-1]) + 4 - (12 if k == 2 and values[-1] == 0 else 0):.1f}" '
                   f'font-size="13" font-weight="700" fill="{color}">{values[-1]}</text>')
        ly = top + 30 + 22 * k
        out.append(f'<line x1="{left + pw + 45}" x2="{left + pw + 75}" y1="{ly}" y2="{ly}" stroke="{color}" stroke-width="{width}"{dash_attr}/>')
        label = name if len(name) < 26 else name.replace(", ", ",\n")
        for j, part in enumerate(label.split("\n")):
            out.append(f'<text x="{left + pw + 82}" y="{ly + 4 + 14 * j}" font-size="12" fill="{INK}">{part}</text>')
    out.append(f'<text x="{left}" y="{h - 10}" font-size="11" fill="{SOFT}">Run md-v4y: 12 changes, 4 documents, 69 sections. Deterministic scan, no model involved.</text>')
    out.append("</svg>")
    (REPO_ROOT / "docs").mkdir(exist_ok=True)
    (REPO_ROOT / "docs" / "year.svg").write_text("\n".join(out), encoding="utf-8")
    print("docs/year.svg written")
    return 0


if __name__ == "__main__":
    sys.exit(main())

import type { CanonVersion, MutationStep } from "./types";

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MONTH_ABBR = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
] as const;

/** Month index (0-11) from a notice like "May: fleet modernisation. ...", else null. */
export function parseMonth(notice: string): number | null {
  const m = /^\s*([A-Za-z]+)\s*:/.exec(notice);
  if (!m) return null;
  const word = m[1].toLowerCase();
  const full = MONTHS.findIndex((mo) => mo.toLowerCase() === word);
  if (full >= 0) return full;
  const abbr = MONTH_ABBR.findIndex((a) => a === word.slice(0, 3));
  return abbr >= 0 ? abbr : null;
}

/** Fact ids changed by a step: new `facts[]` shape, old singular `fact`, or []. */
export function stepFactIds(step: MutationStep): string[] {
  if (step.facts && step.facts.length > 0) return step.facts;
  if (step.fact) return [step.fact];
  return [];
}

/** First sentence after the "Month:" prefix, capitalised — for batch banners. */
export function batchTitle(notice: string): string {
  const withoutMonth = notice.replace(/^\s*[A-Za-z]+\s*:\s*/, "");
  const first = withoutMonth.split(".")[0].trim();
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "Batch change";
}

/** Previous value of a fact: parsed from canon version notes ("F-..: old -> new"). */
export function oldValueFor(factId: string, canon: CanonVersion[]): string | null {
  const re = new RegExp(`^${factId}:\\s*(.+?)\\s*->\\s*(.+?)$`);
  for (const v of canon) {
    const m = re.exec(v.note ?? "");
    if (m) return m[1];
  }
  return null;
}

export function words(s: string): string[] {
  return s.split(/(\s+)/);
}

/** Excerpt of `text` centred on the first match, with [start, end] offsets into it. */
export function excerpt(
  text: string,
  match: string,
  context = 90
): { text: string; start: number; end: number } {
  const i = text.toLowerCase().indexOf(match.toLowerCase());
  if (i < 0) return { text, start: -1, end: -1 };
  const s = Math.max(0, i - context);
  const e = Math.min(text.length, i + match.length + context);
  let out = text.slice(s, e);
  let start = i - s;
  if (s > 0) {
    out = "…" + out;
    start += 1;
  }
  if (e < text.length) out = out + "…";
  return { text: out, start, end: start + match.length };
}

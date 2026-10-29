"use client";

import { Fragment, useMemo, useState } from "react";
import { useT, type StringKey } from "@/lib/i18n";
import type { Contradiction, DocumentInfo, Section } from "@/lib/types";
import { LocLabel } from "./shell";

type Side = "psyche" | "baseline";

/** Where a contradiction touches the section being read, so the quote can be marked in the text. */
function marksFor(sectionId: string, items: Contradiction[]) {
  const marks: { quote: string; c: Contradiction }[] = [];
  for (const c of items) {
    if (c.section_a === sectionId) marks.push({ quote: c.quote_a, c });
    if (c.section_b === sectionId) marks.push({ quote: c.quote_b, c });
  }
  return marks;
}

function MarkedText({ text, quotes }: { text: string; quotes: string[] }) {
  // Find every quote case-insensitively and wrap it; overlapping quotes keep the first.
  const lower = text.toLowerCase();
  const spans: [number, number][] = [];
  for (const q of quotes) {
    const at = lower.indexOf(q.toLowerCase().trim());
    if (at >= 0 && !spans.some(([a, b]) => at < b && at + q.length > a)) spans.push([at, at + q.trim().length]);
  }
  spans.sort((a, b) => a[0] - b[0]);
  const parts: (string | { mark: string })[] = [];
  let pos = 0;
  for (const [a, b] of spans) {
    parts.push(text.slice(pos, a), { mark: text.slice(a, b) });
    pos = b;
  }
  parts.push(text.slice(pos));
  return (
    <>
      {parts.map((p, i) =>
        typeof p === "string" ? (
          <Fragment key={i}>{p}</Fragment>
        ) : (
          <mark key={i} className="bg-hazard-soft text-ink underline decoration-hazard decoration-2 underline-offset-4">
            {p.mark}
          </mark>
        ),
      )}
    </>
  );
}

export function ProductionView({
  documents,
  sectionsPsyche,
  sectionsBaseline,
  contradictionsPsyche,
  contradictionsBaseline,
  focus,
}: {
  documents: DocumentInfo[];
  sectionsPsyche: Section[];
  sectionsBaseline: Section[];
  contradictionsPsyche: Contradiction[];
  contradictionsBaseline: Contradiction[];
  /** Open on this section, e.g. when another tab links to a stale value or a rewritten section. */
  focus?: { doc: string; sectionId: string } | null;
}) {
  const { t } = useT();
  const [docId, setDocId] = useState(focus?.doc ?? documents[0]?.id ?? "ops");
  const [sectionId, setSectionId] = useState(
    focus?.sectionId ?? sectionsPsyche.find((s) => s.doc === (focus?.doc ?? documents[0]?.id ?? "ops"))?.id ?? "",
  );
  const [side, setSide] = useState<Side>("baseline");

  const docOf = useMemo(() => new Map(sectionsPsyche.map((s) => [s.id, s.doc])), [sectionsPsyche]);
  const byId = (list: Section[]) => new Map(list.map((s) => [s.id, s]));
  const psyche = useMemo(() => byId(sectionsPsyche), [sectionsPsyche]);
  const baseline = useMemo(() => byId(sectionsBaseline), [sectionsBaseline]);
  const docTitle = (id: string) => documents.find((d) => d.id === id)?.title ?? id;

  const chapters = useMemo(() => {
    const out: { chapter: number; title: string; sections: Section[] }[] = [];
    for (const s of sectionsPsyche.filter((x) => x.doc === docId)) {
      const last = out[out.length - 1];
      if (last && last.chapter === s.chapter) last.sections.push(s);
      else out.push({ chapter: s.chapter, title: s.chapter_title, sections: [s] });
    }
    return out;
  }, [sectionsPsyche, docId]);

  const issues = { psyche: contradictionsPsyche, baseline: contradictionsBaseline };
  const touches = (c: Contradiction) => docOf.get(c.section_a) === docId || docOf.get(c.section_b) === docId;
  const countIn = (s: Side, sid: string) => marksFor(sid, issues[s]).length;
  const between = (s: Side) => issues[s].filter((c) => docOf.get(c.section_a) !== docOf.get(c.section_b)).length;
  const within = (s: Side) => issues[s].length - between(s);

  const open = (sid: string) => {
    const d = docOf.get(sid);
    if (d) setDocId(d);
    setSectionId(sid);
  };

  const current = psyche.get(sectionId);

  return (
    <div className="grid h-[calc(100vh-58px)] grid-cols-[280px_1fr_340px] max-xl:grid-cols-[240px_1fr] max-lg:h-auto max-lg:grid-cols-1">
      {/* Documents and their sections */}
      <nav aria-label={t("prod.documents")} className="overflow-y-auto border-r-[1.5px] border-ink bg-label">
        <div role="tablist" className="grid grid-cols-2 border-b-[1.5px] border-ink">
          {documents.map((d) => (
            <button
              key={d.id}
              role="tab"
              aria-selected={d.id === docId}
              onClick={() => {
                setDocId(d.id);
                setSectionId(sectionsPsyche.find((s) => s.doc === d.id)?.id ?? "");
              }}
              className={`border-b border-r border-rule px-3 py-2.5 text-left text-[13px] leading-tight ${
                d.id === docId ? "bg-ink text-label" : "hover:bg-concrete"
              }`}
            >
              <span className="block font-display text-[15px] font-semibold uppercase tracking-[0.06em]">{d.id}</span>
              {d.title}
            </button>
          ))}
        </div>
        {chapters.map((ch) => (
          <div key={ch.chapter} className="border-b border-rule py-2">
            <div className="px-4 pb-1 font-display text-[14px] font-semibold uppercase tracking-[0.05em] text-ink-soft">
              {String(ch.chapter).padStart(2, "0")} · {ch.title}
            </div>
            {ch.sections.map((s) => {
              const pe = countIn("psyche", s.id);
              const bl = countIn("baseline", s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => setSectionId(s.id)}
                  aria-current={s.id === sectionId ? "true" : undefined}
                  className={`flex w-full items-center gap-2 px-4 py-1.5 text-left text-[14px] ${
                    s.id === sectionId ? "bg-concrete-deep font-medium" : "hover:bg-concrete"
                  }`}
                >
                  <span className="flex-1 leading-snug">{s.title}</span>
                  {bl > 0 && (
                    <span title={`${t("prod.baseline")}: ${bl}`} className="font-mono text-[12px] text-hazard">
                      B{bl}
                    </span>
                  )}
                  {pe > 0 && (
                    <span title={`${t("prod.engine")}: ${pe}`} className="font-mono text-[12px] text-hazard">
                      P{pe}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* The section, both versions side by side */}
      <section className="min-w-0 overflow-y-auto">
        {current ? (
          <>
            <div className="flex flex-wrap items-end gap-4 border-b-[1.5px] border-ink bg-concrete px-6 pb-4 pt-5">
              <LocLabel id={current.id} size={18} />
              <h1 className="font-display text-[34px] font-semibold uppercase leading-none tracking-[0.01em]">{current.title}</h1>
              <span className="text-[14px] text-ink-soft">
                {docTitle(current.doc)} · {current.chapter_title}
              </span>
            </div>
            <div className="grid grid-cols-2 max-md:grid-cols-1">
              {(["psyche", "baseline"] as Side[]).map((s) => {
                const sec = s === "psyche" ? current : baseline.get(current.id);
                const marks = marksFor(current.id, issues[s]);
                return (
                  <article key={s} className={`px-6 py-5 ${s === "psyche" ? "border-r-[1.5px] border-ink bg-label max-md:border-r-0" : ""}`}>
                    <header className="mb-3 flex items-baseline justify-between gap-3">
                      <h2 className="font-display text-[18px] font-semibold uppercase tracking-[0.05em]">
                        {s === "psyche" ? t("prod.engine") : t("prod.baseline")}
                      </h2>
                      {s === "psyche" && current.attempts > 1 && (
                        <span className="text-[12px] text-ink-soft">
                          ×{current.attempts} · {t("prod.rewritten")}
                        </span>
                      )}
                    </header>
                    {sec ? (
                      <div className="whitespace-pre-line text-[15px] leading-[1.65]">
                        <MarkedText text={sec.text} quotes={marks.map((m) => m.quote)} />
                      </div>
                    ) : (
                      <p className="text-[14px] text-ink-soft">{t("prod.no_text")}</p>
                    )}
                    {marks.length > 0 && (
                      <ul className="mt-5 space-y-2 border-t border-rule pt-3">
                        {marks.map(({ c }) => {
                          const other = c.section_a === current.id ? c.section_b : c.section_a;
                          return (
                            <li key={c.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                              <span className="bg-hazard px-1.5 py-0.5 font-mono text-[11px] uppercase text-label">
                                {t(`cat.${c.category}` as StringKey)}
                              </span>
                              {t("prod.conflicts_with")}
                              <button onClick={() => open(other)} className="underline decoration-rule underline-offset-2 hover:decoration-ink">
                                <LocLabel id={other} size={12} />
                              </button>
                              <span className="w-full text-ink-soft">{c.explanation}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        ) : null}
      </section>

      {/* Contradictions, counted the way the benchmark counts them */}
      <aside className="overflow-y-auto border-l-[1.5px] border-ink bg-label max-xl:col-span-2 max-xl:border-l-0 max-xl:border-t-[1.5px] max-lg:col-span-1">
        <div className="border-b-[1.5px] border-ink px-5 pb-4 pt-5">
          <h2 className="font-display text-[22px] font-semibold uppercase tracking-[0.04em]">{t("prod.issues")}</h2>
          <div className="mt-3 grid grid-cols-2 gap-4">
            {(["psyche", "baseline"] as Side[]).map((s) => (
              <div key={s}>
                <div className={`stencil text-[64px] ${between(s) > 0 ? "text-hazard" : "text-steady"}`}>{between(s)}</div>
                <div className="mt-1 text-[12px] leading-tight text-ink-soft">
                  {s === "psyche" ? t("prod.engine") : "Baseline"} · {t("prod.between")}
                  <br />+{within(s)} {t("prod.within")}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div role="tablist" className="flex border-b-[1.5px] border-ink">
          {(["baseline", "psyche"] as Side[]).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={side === s}
              onClick={() => setSide(s)}
              className={`flex-1 px-3 py-2 font-display text-[15px] font-semibold uppercase tracking-[0.05em] ${
                side === s ? "bg-ink text-label" : "hover:bg-concrete"
              }`}
            >
              {s === "psyche" ? t("prod.engine") : "Baseline"}
            </button>
          ))}
        </div>
        <p className="px-5 pt-3 text-[12px] text-ink-soft">
          {docTitle(docId)} · {t("prod.issues.doc")}
        </p>
        {issues[side].filter(touches).length === 0 ? (
          <p className="px-5 py-4 text-[14px] text-ink-soft">{t("prod.none")}</p>
        ) : (
          <ul>
            {issues[side].filter(touches).map((c) => (
              <li key={c.id} className="border-b border-rule px-5 py-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="bg-hazard px-1.5 py-0.5 font-mono text-[11px] uppercase text-label">
                    {t(`cat.${c.category}` as StringKey)}
                  </span>
                  <span className="text-[12px] text-ink-soft">
                    {docOf.get(c.section_a) === docOf.get(c.section_b) ? t("prod.within") : t("prod.between")}
                  </span>
                </div>
                {[
                  [c.section_a, c.quote_a],
                  [c.section_b, c.quote_b],
                ].map(([sid, quote]) => (
                  <button key={sid} onClick={() => open(sid)} className="mb-2 block w-full text-left">
                    <LocLabel id={sid} size={12} />
                    <span className="mt-1 block border-l-2 border-hazard pl-2 text-[13px] leading-snug">&ldquo;{quote}&rdquo;</span>
                  </button>
                ))}
                <p className="text-[12px] leading-snug text-ink-soft">{c.explanation}</p>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

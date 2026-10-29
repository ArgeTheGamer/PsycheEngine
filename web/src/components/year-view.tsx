"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import type { MutationsFile, MutationStep, Section } from "@/lib/types";
import {
  MONTHS,
  batchTitle,
  excerpt,
  parseMonth,
  stepFactIds,
} from "@/lib/mutations";
import { useT } from "@/lib/i18n";

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MS_PER_MONTH = 1500;

type Slot = {
  month: string;
  steps: MutationStep[];
  psyche: number;
  baseline: number;
  perDoc: number | null;
  psycheRewritten: number;
  baselineRewritten: number;
  perDocRewritten: number | null;
};

function Highlighted({ text, match }: { text: string; match: string }) {
  const { text: ex, start, end } = excerpt(text, match);
  if (start < 0) return <span>{ex}</span>;
  return (
    <span>
      {ex.slice(0, start)}
      <mark className="bg-hazard-soft px-0.5 underline decoration-hazard decoration-2 underline-offset-4">
        {ex.slice(start, end)}
      </mark>
      {ex.slice(end)}
    </span>
  );
}

export function YearView({
  runLabel,
  mutations,
  sectionsBaseline,
  onExit,
}: {
  runLabel: string;
  mutations: MutationsFile;
  sectionsBaseline: Section[];
  onExit: () => void;
}) {
  const { t, tn } = useT();
  const hasPerDoc = useMemo(
    () =>
      mutations.steps.some((s) => s.baseline_per_doc) ||
      mutations.final_audit.baseline_per_doc !== undefined,
    [mutations]
  );

  const monthOf = (s: MutationStep): number => {
    const parsed = parseMonth(s.notice);
    if (parsed !== null) return parsed;
    return Math.min(11, Math.max(0, s.step - 1));
  };

  const slots: Slot[] = useMemo(() => {
    const byMonth: MutationStep[][] = Array.from({ length: 12 }, () => []);
    for (const s of mutations.steps) byMonth[monthOf(s)].push(s);
    let psy = 0;
    let base = 0;
    let per = 0;
    let psyR = 0;
    let baseR = 0;
    let perR = 0;
    return byMonth.map((steps, i) => {
      for (const s of steps) {
        psy = s.engine.stale.length;
        base = s.baseline.stale.length;
        psyR += s.engine.sections_changed;
        baseR += s.baseline.sections_changed;
        if (s.baseline_per_doc) {
          per = s.baseline_per_doc.stale.length;
          perR += s.baseline_per_doc.sections_changed;
        }
      }
      return {
        month: MONTH_ABBR[i],
        steps,
        psyche: psy,
        baseline: base,
        perDoc: hasPerDoc ? per : null,
        psycheRewritten: psyR,
        baselineRewritten: baseR,
        perDocRewritten: hasPerDoc ? perR : null,
      };
    });
  }, [mutations, hasPerDoc]);

  const maxY = useMemo(
    () =>
      Math.max(
        2,
        ...slots.flatMap((s) => [
          s.psyche,
          s.baseline,
          ...(s.perDoc !== null ? [s.perDoc] : []),
        ])
      ),
    [slots]
  );

  const [revealed, setRevealed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [finished, setFinished] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const accRef = useRef(0);

  useEffect(() => {
    if (!playing || finished) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last, 250);
      last = now;
      accRef.current += dt;
      if (accRef.current >= MS_PER_MONTH) {
        accRef.current -= MS_PER_MONTH;
        setRevealed((r) => {
          const next = Math.min(12, r + 1);
          if (next >= 12) setFinished(true);
          return next;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, finished]);

  useEffect(() => {
    setSelectedMonth(null);
  }, [revealed, playing]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        if (!finished) setPlaying((p) => !p);
      } else if (e.key === "ArrowLeft") {
        setPlaying(false);
        setFinished(false);
        setRevealed((r) => Math.max(0, r - 1));
      } else if (e.key === "ArrowRight") {
        setPlaying(false);
        setRevealed((r) => {
          const next = Math.min(12, r + 1);
          if (next >= 12) setFinished(true);
          return next;
        });
      } else if (e.key === "Escape") {
        onExit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, onExit]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const chartData = useMemo(
    () =>
      slots.map((s, i) =>
        i < revealed
          ? s
          : { ...s, psyche: null, baseline: null, perDoc: null }
      ),
    [slots, revealed]
  );

  const currentSteps = useMemo(
    () => slots.slice(0, revealed).flatMap((s) => s.steps),
    [slots, revealed]
  );
  const current = currentSteps.length > 0 ? currentSteps[currentSteps.length - 1] : null;
  const currentFacts = current ? stepFactIds(current) : [];
  const isBatch = currentFacts.length > 1;

  const versions = useMemo(
    () => [
      { key: "psyche", label: t("ver.psyche"), dashed: false },
      { key: "baseline", label: t("ver.baseline_ctx"), dashed: false },
      ...(hasPerDoc
        ? [{ key: "perDoc", label: t("ver.baseline_perdoc"), dashed: true }]
        : []),
    ],
    [hasPerDoc, t]
  );

  const counters = useMemo(() => {
    const slot = revealed > 0 ? slots[revealed - 1] : null;
    return [
      {
        label: t("ver.psyche"),
        stale: slot?.psyche ?? 0,
        rewritten: slot?.psycheRewritten ?? 0,
      },
      {
        label: t("ver.baseline_ctx"),
        stale: slot?.baseline ?? 0,
        rewritten: slot?.baselineRewritten ?? 0,
      },
      ...(hasPerDoc
        ? [
            {
              label: t("ver.baseline_perdoc"),
              stale: slot?.perDoc ?? 0,
              rewritten: slot?.perDocRewritten ?? 0,
            },
          ]
        : []),
    ];
  }, [slots, revealed, hasPerDoc, t]);

  const summary = useMemo(() => {
    // Stale lists are cumulative (each step holds every value still out of date at that point),
    // so the year's result is the last step; only costs add up step by step.
    const last = mutations.steps[mutations.steps.length - 1];
    let psyCost = 0;
    let baseCost = 0;
    for (const s of mutations.steps) {
      psyCost += s.engine.cost_usd;
      baseCost += s.baseline.cost_usd;
    }
    return {
      psy: last?.engine.stale.length ?? 0,
      base: last?.baseline.stale.length ?? 0,
      per: last?.baseline_per_doc?.stale.length ?? 0,
      psyCost,
      baseCost,
    };
  }, [mutations]);

  const selectedStep =
    selectedMonth !== null
      ? (slots[selectedMonth]?.steps.length ?? 0) > 0
        ? slots[selectedMonth].steps[slots[selectedMonth].steps.length - 1]
        : null
      : null;

  const staleCards = useMemo(() => {
    if (!selectedStep) return [];
    const groups: { label: string; hits: { fact_id: string; match: string; section_id: string }[] }[] = [
      { label: t("ver.baseline_ctx"), hits: selectedStep.baseline.stale },
    ];
    if (selectedStep.baseline_per_doc) {
      groups.push({
        label: t("ver.baseline_perdoc"),
        hits: selectedStep.baseline_per_doc.stale,
      });
    }
    return groups;
  }, [selectedStep, t]);

  const paused = !playing && !finished;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-concrete"
      role="dialog"
      aria-modal="true"
      aria-label={t("yo.title")}
    >
      <div className="flex flex-wrap items-center gap-3 border-b-[1.5px] border-ink bg-label px-6 py-3">
        <div>
          <div className="font-display text-[24px] font-semibold uppercase leading-none tracking-[0.02em]">
            {t("yo.title")}
          </div>
          <div className="mt-1 text-[13px] text-ink-soft">
            {runLabel} · 12 {tn("n.months", 12)}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!finished) setPlaying((p) => !p);
            }}
            className="flex items-center gap-2 border-[1.5px] border-ink bg-label px-3 py-1.5 font-display text-[16px] font-semibold uppercase tracking-[0.04em]"
          >
            {playing && !finished ? (
              <>
                <Pause size={14} aria-hidden /> {t("yo.pause")}
              </>
            ) : (
              <>
                <Play size={14} aria-hidden /> {t("yo.play")}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setRevealed(0);
              setFinished(false);
              setPlaying(true);
              accRef.current = 0;
            }}
            className="flex items-center gap-2 border-[1.5px] border-ink bg-label px-3 py-1.5 font-display text-[16px] font-semibold uppercase tracking-[0.04em]"
          >
            <RotateCcw size={14} aria-hidden /> {t("yo.replay")}
          </button>
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-2 border-[1.5px] border-ink bg-ink px-3 py-1.5 font-display text-[16px] font-semibold uppercase tracking-[0.04em] text-label"
          >
            <X size={14} aria-hidden /> {t("yo.exit")}
          </button>
        </div>
      </div>

      <div className="border-b-[1.5px] border-ink bg-label px-6 py-3">
        <div className="h-2 bg-concrete-deep">
          <div className="h-full bg-ink" style={{ width: `${(revealed / 12) * 100}%` }} />
        </div>
        <div className="mt-1 text-[14px] text-ink-soft">
          {revealed === 0
            ? t("yo.press_play")
            : `${t("yo.month")} ${revealed} / 12 · ${MONTHS[revealed - 1]}`}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-3">
        <div className="flex min-h-0 flex-col lg:col-span-2">
          <div className="border-b-[1.5px] border-ink px-6 py-4">
            <div className="font-display text-[18px] font-semibold uppercase tracking-[0.05em]">
              {t("year.stale_chart")}
            </div>
            <div className="mb-2 mt-1 flex flex-wrap items-center gap-4 text-[13px] text-ink-soft">
              {versions.map((v) => (
                <span key={v.key} className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-0 w-6 border-t-[3px]"
                    style={{
                      borderColor:
                        v.key === "psyche" ? "var(--color-ink)" : "var(--color-hazard)",
                      borderTopStyle: v.dashed ? "dashed" : "solid",
                    }}
                  />
                  {v.label}
                </span>
              ))}
              {paused && <span>{t("yo.paused_hint")}</span>}
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ left: -12, right: 12, top: 8 }}
                  onClick={(s) => {
                    if (!paused) return;
                    const st = s as unknown as {
                      activeTooltipIndex?: number;
                    } | null;
                    const i = st?.activeTooltipIndex;
                    if (i === undefined || i === null || i >= revealed) return;
                    setSelectedMonth(i);
                  }}
                >
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "var(--color-ink-soft)", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--color-ink)" }}
                  />
                  <YAxis
                    domain={[-0.5, maxY + 1]}
                    tick={{ fill: "var(--color-ink-soft)", fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--color-ink)" }}
                    allowDecimals={false}
                    tickFormatter={(v: number) => (v < 0 ? "" : String(v))}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-label)",
                      border: "1.5px solid var(--color-ink)",
                      borderRadius: 0,
                      fontSize: 13,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="psyche"
                    name={t("ver.psyche")}
                    stroke="var(--color-ink)"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="baseline"
                    name={t("ver.baseline_ctx")}
                    stroke="var(--color-hazard)"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                  {hasPerDoc && (
                    <Line
                      type="monotone"
                      dataKey="perDoc"
                      name={t("ver.baseline_perdoc")}
                      stroke="var(--color-hazard)"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={{ r: 4 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {paused && revealed > 0 && (
              <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label={t("yo.paused_hint")}>
                {slots.slice(0, revealed).map((s, i) => (
                  <button
                    key={s.month}
                    type="button"
                    onClick={() => setSelectedMonth(i)}
                    aria-pressed={selectedMonth === i}
                    className={`border px-2 py-1 font-mono text-[12px] ${
                      selectedMonth === i
                        ? "border-ink bg-ink text-label"
                        : "border-rule bg-label hover:border-ink"
                    }`}
                  >
                    {s.month}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="px-6 py-4">
            {current ? (
              <>
                {isBatch && (
                  <div className="mb-3 bg-ink px-4 py-2.5 font-display text-[20px] font-semibold uppercase tracking-[0.03em] text-label">
                    {batchTitle(current.notice)}: {currentFacts.length}{" "}
                    {tn("n.facts_changed", currentFacts.length)}
                  </div>
                )}
                <p className="max-w-[72ch] text-[20px] leading-relaxed">{current.notice}</p>
              </>
            ) : (
              <p className="text-[20px] text-ink-soft">{t("yo.not_started")}</p>
            )}
            {selectedStep && staleCards.length > 0 && (
              <div className="mt-4 flex flex-col gap-3">
                <div className="font-display text-[16px] font-semibold uppercase tracking-[0.05em]">
                  {MONTH_ABBR[selectedMonth ?? 0]} — {t("yo.left_behind")}
                </div>
                {staleCards.map((g) => (
                  <div key={g.label}>
                    <div className="mb-1 text-[13px] font-medium text-hazard">
                      {g.label} · {Math.min(3, g.hits.length)} {t("yo.of")} {g.hits.length}
                    </div>
                    {g.hits.length === 0 ? (
                      <p className="text-[14px] text-ink-soft">{t("yo.none")}</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
                        {g.hits.slice(0, 3).map((h, i) => {
                          // Only show surrounding text if it really contains the match: the per-document
                          // baseline's sections are a different text from the one loaded here.
                          const sec = sectionsBaseline.find(
                            (x) => x.id === h.section_id && x.text.includes(h.match)
                          );
                          return (
                            <div
                              key={`${h.section_id}-${h.match}-${i}`}
                              className="border-[1.5px] border-ink bg-label p-3"
                            >
                              <div className="mb-1 flex flex-wrap items-center gap-2">
                                <span className="bg-hazard px-1.5 py-0.5 font-mono text-[11px] uppercase text-label">
                                  {h.fact_id}
                                </span>
                                <span className="text-[12px] text-ink-soft">
                                  {t("year.still_says")} {h.match}
                                </span>
                              </div>
                              <p className="text-[14px] leading-snug">
                                {sec ? <Highlighted text={sec.text} match={h.match} /> : h.match}
                              </p>
                              <p className="mt-1.5 font-mono text-[12px] text-ink-soft">
                                {sec ? `${sec.chapter_title} › ${sec.title}` : h.section_id}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col border-l-[1.5px] border-ink bg-label max-lg:border-l-0 max-lg:border-t-[1.5px]">
          {counters.map((c, i) => (
            <div
              key={c.label}
              className={`px-6 py-5 ${i < counters.length - 1 ? "border-b-[1.5px] border-ink" : ""}`}
            >
              <div className="font-display text-[16px] font-semibold uppercase tracking-[0.05em]">
                {c.label}
              </div>
              <div className="stencil mt-1 text-[76px]">{c.stale}</div>
              <div className="text-[14px] text-ink-soft">{tn("n.stale", c.stale)}</div>
              <div className="mt-2 border-t border-rule pt-2 text-[14px]">
                <span className="font-mono text-[18px] font-semibold">{c.rewritten}</span>{" "}
                <span className="text-ink-soft">{tn("n.sections_rewritten", c.rewritten)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {finished && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink/70 p-4">
          <div className="w-[min(720px,90vw)] border-[1.5px] border-ink bg-label p-8 text-center">
            <div className="font-display text-[30px] font-semibold uppercase leading-tight tracking-[0.02em]">
              {mutations.steps.length} {tn("n.changes", mutations.steps.length)} ·{" "}
              {t("ver.psyche")} {summary.psy} {tn("n.stale", summary.psy)}
            </div>
            <div className="mt-2 text-[19px]">
              {t("ver.baseline")} {summary.base}
              {hasPerDoc ? ` / ${summary.per}` : ""} · {t("yo.cost")} $
              {summary.psyCost.toFixed(2)} {t("year.vs")} ${summary.baseCost.toFixed(2)}
            </div>
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setRevealed(0);
                  setFinished(false);
                  setPlaying(true);
                  accRef.current = 0;
                }}
                className="flex items-center gap-2 border-[1.5px] border-ink bg-label px-4 py-2 font-display text-[16px] font-semibold uppercase tracking-[0.04em]"
              >
                <RotateCcw size={14} aria-hidden /> {t("yo.replay")}
              </button>
              <button
                type="button"
                onClick={onExit}
                className="flex items-center gap-2 border-[1.5px] border-ink bg-ink px-4 py-2 font-display text-[16px] font-semibold uppercase tracking-[0.04em] text-label"
              >
                <X size={14} aria-hidden /> {t("yo.exit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

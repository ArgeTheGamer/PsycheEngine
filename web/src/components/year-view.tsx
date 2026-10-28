"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
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
import { Badge, Button } from "./ui";
import { VERSION_LABELS } from "./maintenance-tab";

const PSYCHE = "#34d399";
const BASELINE = "#fb7185";
const BASELINE_PER_DOC = "#be123c";
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
      <mark className="rounded bg-amber-400/30 px-0.5 text-amber-200">
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

  const counters = useMemo(() => {
    const slot = revealed > 0 ? slots[revealed - 1] : null;
    return [
      {
        label: VERSION_LABELS.psyche,
        color: PSYCHE,
        stale: slot?.psyche ?? 0,
        rewritten: slot?.psycheRewritten ?? 0,
      },
      {
        label: VERSION_LABELS.baseline,
        color: BASELINE,
        stale: slot?.baseline ?? 0,
        rewritten: slot?.baselineRewritten ?? 0,
      },
      ...(hasPerDoc
        ? [
            {
              label: VERSION_LABELS.perDoc,
              color: BASELINE_PER_DOC,
              stale: slot?.perDoc ?? 0,
              rewritten: slot?.perDocRewritten ?? 0,
            },
          ]
        : []),
    ];
  }, [slots, revealed, hasPerDoc]);

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
    const groups: { label: string; color: string; hits: { fact_id: string; match: string; section_id: string }[] }[] = [
      { label: VERSION_LABELS.baseline, color: BASELINE, hits: selectedStep.baseline.stale },
    ];
    if (selectedStep.baseline_per_doc) {
      groups.push({
        label: VERSION_LABELS.perDoc,
        color: BASELINE_PER_DOC,
        hits: selectedStep.baseline_per_doc.stale,
      });
    }
    return groups;
  }, [selectedStep]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 p-6 text-zinc-100">
      <div className="mb-4 flex items-center gap-3">
        <div>
          <div className="text-xl font-semibold">A year of changes</div>
          <div className="text-sm text-zinc-500">{runLabel} · 12 months</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              if (!finished) setPlaying((p) => !p);
            }}
          >
            {playing && !finished ? (
              <span className="flex items-center gap-1.5">
                <Pause size={14} /> Pause
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Play size={14} /> Play
              </span>
            )}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setRevealed(0);
              setFinished(false);
              setPlaying(true);
              accRef.current = 0;
            }}
          >
            <span className="flex items-center gap-1.5">
              <RotateCcw size={14} /> Replay
            </span>
          </Button>
          <Button variant="secondary" onClick={onExit}>
            <span className="flex items-center gap-1.5">
              <X size={14} /> Exit
            </span>
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-emerald-400 transition-[width]"
            style={{ width: `${(revealed / 12) * 100}%` }}
          />
        </div>
        <div className="mt-1 text-sm text-zinc-400">
          {revealed === 0
            ? "Press play to run the year"
            : `Month ${revealed} of 12 · ${MONTHS[revealed - 1]}`}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex min-h-0 flex-col gap-4 lg:col-span-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="mb-1 text-base font-medium text-zinc-200">
              Out-of-date values in the documents
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-6 rounded-full"
                  style={{ background: PSYCHE }}
                />
                {VERSION_LABELS.psyche}
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-6 rounded-full"
                  style={{ background: BASELINE }}
                />
                {VERSION_LABELS.baseline}
              </span>
              {hasPerDoc && (
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-6 rounded-full"
                    style={{ background: BASELINE_PER_DOC }}
                  />
                  {VERSION_LABELS.perDoc}
                </span>
              )}
              {!playing && !finished && (
                <span className="text-zinc-500">
                  Paused — click a month to inspect its stale values
                </span>
              )}
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ left: -12, right: 12, top: 8 }}
                  onClick={(s) => {
                    if (playing || finished) return;
                    const st = s as unknown as {
                      activeTooltipIndex?: number;
                    } | null;
                    const i = st?.activeTooltipIndex;
                    if (i === undefined || i === null || i >= revealed) return;
                    setSelectedMonth(i);
                  }}
                >
                  <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fill: "#a1a1aa", fontSize: 12 }} />
                  <YAxis
                    domain={[-0.5, maxY + 1]}
                    tick={{ fill: "#a1a1aa", fontSize: 12 }}
                    allowDecimals={false}
                    tickFormatter={(v: number) => (v < 0 ? "" : String(v))}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#18181b",
                      border: "1px solid #3f3f46",
                      borderRadius: 8,
                      fontSize: 13,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="psyche"
                    name={VERSION_LABELS.psyche}
                    stroke={PSYCHE}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="baseline"
                    name={VERSION_LABELS.baseline}
                    stroke={BASELINE}
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                  />
                  {hasPerDoc && (
                    <Line
                      type="monotone"
                      dataKey="perDoc"
                      name={VERSION_LABELS.perDoc}
                      stroke={BASELINE_PER_DOC}
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            {current ? (
              <>
                {isBatch && (
                  <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-lg font-semibold text-amber-200">
                    {batchTitle(current.notice)}: {currentFacts.length} facts at
                    once
                  </div>
                )}
                <p className="text-xl leading-relaxed text-zinc-100">
                  {current.notice}
                </p>
              </>
            ) : (
              <p className="text-xl text-zinc-500">
                The year has not started yet — press play.
              </p>
            )}
            {selectedStep && staleCards.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                <div className="text-sm font-medium text-zinc-300">
                  {MONTH_ABBR[selectedMonth ?? 0]} — stale values the baselines
                  left behind
                </div>
                {staleCards.map((g) => (
                  <div key={g.label}>
                    <div
                      className="mb-1 text-xs font-medium"
                      style={{ color: g.color }}
                    >
                      {g.label} · showing {Math.min(3, g.hits.length)} of{" "}
                      {g.hits.length}
                    </div>
                    {g.hits.length === 0 ? (
                      <p className="text-sm text-zinc-500">None this month.</p>
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
                              className="rounded-lg border border-zinc-800 bg-zinc-900 p-3"
                            >
                              <div className="mb-1 flex items-center gap-2">
                                <Badge variant="warn">{h.fact_id}</Badge>
                                <span className="text-[11px] text-zinc-500">
                                  still says {h.match}
                                </span>
                              </div>
                              <p className="text-sm leading-snug text-zinc-300">
                                {sec ? (
                                  <Highlighted text={sec.text} match={h.match} />
                                ) : (
                                  h.match
                                )}
                              </p>
                              <p className="mt-1.5 font-mono text-[11px] text-zinc-500">
                                {sec
                                  ? `${sec.chapter_title} › ${sec.title}`
                                  : h.section_id}
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

        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          {counters.map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
            >
              <div
                className="text-sm font-medium"
                style={{ color: c.color }}
              >
                {c.label}
              </div>
              <div className="mt-1 text-5xl font-bold tabular-nums">
                {c.stale}
              </div>
              <div className="text-sm text-zinc-500">out-of-date values</div>
              <div className="mt-2 border-t border-zinc-800 pt-2 text-sm text-zinc-400">
                <span className="font-mono text-lg text-zinc-200">
                  {c.rewritten}
                </span>{" "}
                sections rewritten
              </div>
            </div>
          ))}
        </div>
      </div>

      {finished && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/85">
          <div className="w-[min(680px,90vw)] rounded-2xl border border-zinc-700 bg-zinc-900 p-8 text-center shadow-2xl">
            <div className="text-3xl font-bold">
              {mutations.steps.length} changes ·{" "}
              <span className="text-emerald-300">
                PsycheEngine {summary.psy} out-of-date values
              </span>
            </div>
            <div className="mt-2 text-xl text-zinc-300">
              baseline {summary.base}
              {hasPerDoc ? ` / ${summary.per}` : ""} · cost $
              {summary.psyCost.toFixed(2)} vs ${summary.baseCost.toFixed(2)}
            </div>
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                onClick={() => {
                  setRevealed(0);
                  setFinished(false);
                  setPlaying(true);
                  accRef.current = 0;
                }}
              >
                <span className="flex items-center gap-1.5">
                  <RotateCcw size={14} /> Replay
                </span>
              </Button>
              <Button variant="secondary" onClick={onExit}>
                <span className="flex items-center gap-1.5">
                  <X size={14} /> Exit
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

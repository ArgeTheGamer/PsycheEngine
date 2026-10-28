"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  CanonVersion,
  DocumentInfo,
  Fact,
  MutationStep,
  MutationsFile,
  RunId,
  Section,
} from "@/lib/types";
import {
  MONTHS,
  batchTitle,
  excerpt,
  oldValueFor,
  parseMonth,
  stepFactIds,
} from "@/lib/mutations";
import { Badge } from "./ui";

const PSYCHE = "#34d399";
const BASELINE = "#fb7185";
const BASELINE_PER_DOC = "#be123c";
const axisTick = { fill: "#a1a1aa", fontSize: 10 };

export const VERSION_LABELS = {
  psyche: "PsycheEngine",
  baseline: "Baseline · one context",
  perDoc: "Baseline · each document separately",
} as const;

function words(s: string): string {
  return s.replace(/_/g, " ");
}

export type OpenSection = (run: RunId, doc: string, sectionId: string) => void;

function StepCard({
  step,
  stepIndex,
  stepCount,
  latest,
  canon,
}: {
  step: MutationStep;
  stepIndex: number;
  stepCount: number;
  latest: Map<string, Fact>;
  canon: CanonVersion[];
}) {
  const factIds = stepFactIds(step);
  const monthIdx = parseMonth(step.notice);
  const batch = factIds.length > 1;
  const first = factIds.length > 0 ? latest.get(factIds[0]) : undefined;
  const oldValue =
    !batch && factIds.length === 1 ? oldValueFor(factIds[0], canon) : null;
  const hoverList = factIds
    .map((id) => {
      const f = latest.get(id);
      const old = oldValueFor(id, canon);
      const change =
        f && old !== null
          ? `${old} → ${f.value}${f.unit ? ` ${f.unit}` : ""}`
          : "not in canon";
      return `${id}: ${change}`;
    })
    .join("\n");
  return (
    <div className="flex min-w-[220px] flex-1 snap-start flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex items-center gap-2">
        <Badge>
          {monthIdx !== null ? MONTHS[monthIdx] : `Step ${step.step}`}
        </Badge>
        {monthIdx !== null && (
          <span className="text-[11px] text-zinc-500">
            change {stepIndex + 1} of {stepCount}
          </span>
        )}
        <span className="font-mono text-xs text-zinc-400">
          {factIds.length === 1 ? factIds[0] : ""}
        </span>
        {batch && (
          <span
            className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-300"
            title={hoverList}
          >
            {factIds.length} facts changed
          </span>
        )}
      </div>
      <p className="text-sm leading-snug text-zinc-200">{step.notice}</p>
      {batch ? (
        <p className="text-sm text-amber-200" title={hoverList}>
          {batchTitle(step.notice)}: {factIds.length} facts at once
        </p>
      ) : (
        <p className="font-mono text-sm">
          {first ? (
            <>
              <span className="text-zinc-400">
                {words(first.subject)} {words(first.attribute)}{" "}
              </span>
              {oldValue !== null ? (
                <>
                  <span className="text-rose-300 line-through">{oldValue}</span>
                  <span className="text-zinc-500"> → </span>
                </>
              ) : null}
              <span className="text-emerald-300">{first.value}</span>
              {first.unit ? (
                <span className="text-zinc-400"> {first.unit}</span>
              ) : null}
            </>
          ) : (
            <span className="text-zinc-500">
              {factIds[0] ?? step.fact ?? "unknown fact"} (not in canon)
            </span>
          )}
        </p>
      )}
      {step.derived.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] tracking-wide text-zinc-500 uppercase">
            Knock-on · computed in code
          </span>
          <div className="flex flex-wrap gap-1">
            {step.derived.map((d) => {
              const f = latest.get(d.fact_id);
              return (
                <Badge key={d.fact_id} variant="warn" title={d.fact_id}>
                  {f ? `${words(f.subject)} ` : `${d.fact_id} `}
                  {d.old_value} → {d.new_value}
                  {f?.unit ? ` ${f.unit}` : ""}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

type TipEntry = {
  dataKey?: string | number;
  name?: string;
  value?: number | string;
  color?: string;
};

function StepTip({
  active,
  payload,
  label,
  money,
}: {
  active?: boolean;
  payload?: TipEntry[];
  label?: number | string;
  money: Array<[string, number]>;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-2 text-xs shadow-xl">
      <div className="mb-1 font-medium text-zinc-300">Change {label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color ?? "#888" }}
          />
          <span className="text-zinc-400">
            {p.dataKey === "psyche"
              ? VERSION_LABELS.psyche
              : p.dataKey === "perDoc"
                ? VERSION_LABELS.perDoc
                : VERSION_LABELS.baseline}
            :
          </span>
          <span className="font-mono text-zinc-100">{p.value}</span>
        </div>
      ))}
      {money.map(([name, usd]) => (
        <div key={name} className="mt-0.5 flex items-center gap-1.5">
          <span className="text-zinc-500">$</span>
          <span className="text-zinc-400">{name}:</span>
          <span className="font-mono text-zinc-100">${usd.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

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

function SectionLine({
  sectionId,
  sections,
  onOpen,
}: {
  sectionId: string;
  sections: Section[];
  onOpen?: OpenSection;
}) {
  const s = sections.find((x) => x.id === sectionId);
  const label = s ? `${s.chapter_title} › ${s.title}` : sectionId;
  if (!onOpen || !s)
    return <span className="font-mono text-[11px] text-zinc-500">{label}</span>;
  return (
    <button
      type="button"
      onClick={() => onOpen("baseline", s.doc, s.id)}
      className="font-mono text-[11px] text-sky-400 hover:text-sky-300 hover:underline"
    >
      {label} →
    </button>
  );
}

export function MaintenanceTab({
  mutations,
  canon,
  sectionsPsyche,
  sectionsBaseline,
  documents,
  onOpenSection,
}: {
  mutations: MutationsFile;
  canon: CanonVersion[];
  sectionsPsyche: Section[];
  sectionsBaseline: Section[];
  documents: DocumentInfo[];
  onOpenSection?: OpenSection;
}) {
  const onOpen = onOpenSection;
  const docTitle = useMemo(() => {
    const m = new Map(documents.map((d) => [d.id, d.title]));
    return (doc: string) => m.get(doc) ?? doc;
  }, [documents]);

  const latest = useMemo(() => {
    const v = canon[canon.length - 1];
    return new Map((v?.facts ?? []).map((f) => [f.id, f]));
  }, [canon]);

  const hasPerDoc = useMemo(
    () =>
      mutations.steps.some((s) => s.baseline_per_doc) ||
      mutations.final_audit.baseline_per_doc !== undefined,
    [mutations]
  );

  const staleData = useMemo(
    () =>
      mutations.steps.map((s) => ({
        step: `C${s.step}`,
        psyche: s.engine.stale.length,
        baseline: s.baseline.stale.length,
        ...(s.baseline_per_doc
          ? { perDoc: s.baseline_per_doc.stale.length }
          : {}),
      })),
    [mutations]
  );

  const rewriteData = useMemo(
    () =>
      mutations.steps.map((s) => ({
        step: `C${s.step}`,
        psyche: s.engine.sections_changed,
        baseline: s.baseline.sections_changed,
        ...(s.baseline_per_doc
          ? { perDoc: s.baseline_per_doc.sections_changed }
          : {}),
      })),
    [mutations]
  );

  const totals = useMemo(() => {
    const t = { psyche: 0, baseline: 0, perDoc: 0 };
    for (const s of mutations.steps) {
      t.psyche += s.engine.cost_usd;
      t.baseline += s.baseline.cost_usd;
      t.perDoc += s.baseline_per_doc?.cost_usd ?? 0;
    }
    return t;
  }, [mutations]);

  const versions = useMemo(() => {
    const staleBy = (get: (s: MutationStep) => typeof s.engine) => {
      const seen = new Set<string>();
      const out: { fact_id: string; match: string; section_id: string }[] = [];
      for (const s of mutations.steps) {
        for (const h of get(s).stale) {
          const key = `${h.section_id}::${h.match}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(h);
        }
      }
      return out;
    };
    return [
      {
        key: "baseline",
        title: `Still wrong after ${mutations.steps.length} changes — ${VERSION_LABELS.baseline}`,
        sections: sectionsBaseline,
        stale: staleBy((s) => s.baseline),
        audit: mutations.final_audit.baseline,
      },
      ...(hasPerDoc
        ? [
            {
              key: "perDoc",
              title: `Still wrong after ${mutations.steps.length} changes — ${VERSION_LABELS.perDoc}`,
              sections: sectionsBaseline,
              stale: staleBy(
                (s) => s.baseline_per_doc ?? { ...s.baseline, stale: [] }
              ),
              audit: mutations.final_audit.baseline_per_doc,
            },
          ]
        : []),
      {
        key: "psyche",
        title: `Still wrong after ${mutations.steps.length} changes — ${VERSION_LABELS.psyche}`,
        sections: sectionsPsyche,
        stale: staleBy((s) => s.engine),
        audit: mutations.final_audit.engine,
      },
    ];
  }, [mutations, sectionsBaseline, sectionsPsyche, hasPerDoc]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex snap-x gap-2 overflow-x-auto pb-1">
        {mutations.steps.map((s, i) => (
          <StepCard
            key={s.step}
            step={s}
            stepIndex={i}
            stepCount={mutations.steps.length}
            latest={latest}
            canon={canon}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="mb-1 text-sm font-medium text-zinc-200">
            Stale values left in the documents
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-6 rounded-full"
                style={{ background: PSYCHE }}
              />
              {VERSION_LABELS.psyche}
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-6 rounded-full"
                style={{ background: BASELINE }}
              />
              {VERSION_LABELS.baseline}
            </span>
            {hasPerDoc && (
              <span className="flex items-center gap-1">
                <span
                  className="inline-block h-2 w-6 rounded-full"
                  style={{ background: BASELINE_PER_DOC }}
                />
                {VERSION_LABELS.perDoc}
              </span>
            )}
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={staleData} margin={{ left: -18, right: 8 }}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <XAxis dataKey="step" tick={axisTick} />
                <YAxis tick={axisTick} allowDecimals={false} />
                <Tooltip
                  content={
                    <StepTip
                      money={[
                        [VERSION_LABELS.psyche, totals.psyche],
                        [VERSION_LABELS.baseline, totals.baseline],
                        ...(hasPerDoc
                          ? [[VERSION_LABELS.perDoc, totals.perDoc] as [string, number]]
                          : []),
                      ]}
                    />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="psyche"
                  stroke={PSYCHE}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="baseline"
                  stroke={BASELINE}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                {hasPerDoc && (
                  <Line
                    type="monotone"
                    dataKey="perDoc"
                    stroke={BASELINE_PER_DOC}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="mb-1 text-sm font-medium text-zinc-200">
            Sections rewritten per change
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
            <span>
              Cost {VERSION_LABELS.psyche}:{" "}
              <span className="font-mono text-zinc-200">
                ${totals.psyche.toFixed(2)}
              </span>
            </span>
            <span>
              Cost {VERSION_LABELS.baseline}:{" "}
              <span className="font-mono text-zinc-200">
                ${totals.baseline.toFixed(2)}
              </span>
            </span>
            {hasPerDoc && (
              <span>
                Cost {VERSION_LABELS.perDoc}:{" "}
                <span className="font-mono text-zinc-200">
                  ${totals.perDoc.toFixed(2)}
                </span>
              </span>
            )}
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rewriteData} margin={{ left: -18, right: 8 }}>
                <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                <XAxis dataKey="step" tick={axisTick} />
                <YAxis tick={axisTick} allowDecimals={false} />
                <Tooltip cursor={{ fill: "#27272a55" }} content={<StepTip money={[]} />} />
                <Bar dataKey="psyche" fill={PSYCHE} radius={[2, 2, 0, 0]} />
                <Bar dataKey="baseline" fill={BASELINE} radius={[2, 2, 0, 0]} />
                {hasPerDoc && (
                  <Bar dataKey="perDoc" fill={BASELINE_PER_DOC} radius={[2, 2, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {versions.map((v) => {
        const violations = v.audit?.violations ?? [];
        const contras = v.audit?.contradictions ?? [];
        const clean =
          v.stale.length === 0 && violations.length === 0 && contras.length === 0;
        return (
          <div key={v.key}>
            <div className="mb-2 text-sm font-medium text-zinc-200">{v.title}</div>
            {clean ? (
              <div className="rounded-lg border border-emerald-900 bg-emerald-950/30 p-4 text-center">
                <p className="text-base text-emerald-200">0 stale values</p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Every change was applied everywhere it was needed.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-3">
                {v.stale.map((h) => {
                  const sec = v.sections.find((x) => x.id === h.section_id);
                  return (
                    <div
                      key={`${h.section_id}::${h.match}`}
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
                      <div className="mt-1.5">
                        <SectionLine
                          sectionId={h.section_id}
                          sections={v.sections}
                          onOpen={v.key === "psyche" ? undefined : onOpen}
                        />
                      </div>
                    </div>
                  );
                })}
                {violations.map((x, i) => (
                  <div
                    key={`v${i}`}
                    className="rounded-lg border border-rose-900/60 bg-rose-950/20 p-3"
                  >
                    <div className="mb-1">
                      <Badge variant="danger">audit violation</Badge>
                    </div>
                    <p className="font-mono text-[11px] text-zinc-500">
                      {x.fact_id} · {x.category}
                    </p>
                    <p className="text-sm text-zinc-300">“{x.quote}”</p>
                    <p className="mt-1 text-xs text-zinc-500">{x.explanation}</p>
                    <div className="mt-1.5">
                      <SectionLine
                        sectionId={x.section_id}
                        sections={v.sections}
                        onOpen={v.key === "psyche" ? undefined : onOpen}
                      />
                    </div>
                  </div>
                ))}
                {contras.map((c, i) => (
                  <div
                    key={`${c.section_a}-${c.section_b}-${i}`}
                    className="rounded-lg border border-rose-900/60 bg-rose-950/20 p-3"
                  >
                    <div className="mb-1">
                      <Badge variant="danger">contradiction</Badge>
                    </div>
                    <p className="text-[13px] text-zinc-300">
                      “{c.quote_a}”{" "}
                      <span className="text-zinc-500">vs</span> “{c.quote_b}”
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{c.explanation}</p>
                    <p className="mt-1 font-mono text-[11px] text-zinc-500">
                      {docTitle(c.section_a.split(".")[0])} · {c.section_a}
                      {" ↔ "}
                      {docTitle(c.section_b.split(".")[0])} · {c.section_b}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

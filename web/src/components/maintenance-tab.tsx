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
import { Badge } from "./ui";

const PSYCHE = "#34d399";
const BASELINE = "#fb7185";
const axisTick = { fill: "#a1a1aa", fontSize: 10 };

function words(s: string): string {
  return s.replace(/_/g, " ");
}

export type OpenSection = (run: RunId, doc: string, sectionId: string) => void;

function oldValueFor(factId: string, canon: CanonVersion[]): string | null {
  const re = new RegExp(`^${factId}:\\s*(.+?)\\s*->\\s*(.+?)$`);
  for (const v of canon) {
    const m = re.exec(v.note ?? "");
    if (m) return m[1];
  }
  return null;
}

function StepCard({
  step,
  fact,
  oldValue,
  derivedFacts,
}: {
  step: MutationStep;
  fact: Fact | undefined;
  oldValue: string | null;
  derivedFacts: Map<string, Fact>;
}) {
  return (
    <div className="flex min-w-[220px] flex-1 snap-start flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex items-center gap-2">
        <Badge>Step {step.step}</Badge>
        <span className="font-mono text-xs text-zinc-400">{step.fact}</span>
      </div>
      <p className="text-sm leading-snug text-zinc-200">{step.notice}</p>
      <p className="font-mono text-sm">
        {fact ? (
          <>
            <span className="text-zinc-400">
              {words(fact.subject)} {words(fact.attribute)}{" "}
            </span>
            {oldValue !== null ? (
              <>
                <span className="text-rose-300 line-through">{oldValue}</span>
                <span className="text-zinc-500"> → </span>
              </>
            ) : null}
            <span className="text-emerald-300">{fact.value}</span>
            {fact.unit ? <span className="text-zinc-400"> {fact.unit}</span> : null}
          </>
        ) : (
          <span className="text-zinc-500">{step.fact} (not in canon)</span>
        )}
      </p>
      {step.derived.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] tracking-wide text-zinc-500 uppercase">
            Knock-on · computed in code
          </span>
          <div className="flex flex-wrap gap-1">
            {step.derived.map((d) => {
              const f = derivedFacts.get(d.fact_id);
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
  money?: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs shadow-xl">
      <div className="mb-1 font-mono text-zinc-400">Step {label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ background: p.color ?? "#888" }}
          />
          <span className="text-zinc-400">{p.name}</span>
          <span className="ml-auto pl-3 font-mono">
            {typeof p.value === "number" && money
              ? `$${p.value.toFixed(4)}`
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <span className="ml-auto flex items-center gap-3 text-[11px] text-zinc-400">
      <span className="flex items-center gap-1">
        <span className="size-2 rounded-full" style={{ background: PSYCHE }} />
        PsycheEngine
      </span>
      <span className="flex items-center gap-1">
        <span className="size-2 rounded-full" style={{ background: BASELINE }} />
        Baseline
      </span>
    </span>
  );
}

function excerpt(
  text: string,
  match: string,
  radius = 140,
): { before: string; hit: string; after: string } | null {
  const i = text.indexOf(match);
  if (i === -1 || match.length === 0) return null;
  const start = Math.max(0, i - radius);
  const end = Math.min(text.length, i + match.length + radius);
  return {
    before: (start > 0 ? "…" : "") + text.slice(start, i),
    hit: match,
    after:
      text.slice(i + match.length, end) + (end < text.length ? "…" : ""),
  };
}

function SectionLink({
  run,
  sectionId,
  sections,
  documents,
  onOpen,
}: {
  run: RunId;
  sectionId: string;
  sections: Section[];
  documents: DocumentInfo[];
  onOpen: OpenSection;
}) {
  const section = sections.find((s) => s.id === sectionId);
  if (!section) {
    return (
      <span className="font-mono text-xs text-zinc-500">{sectionId}</span>
    );
  }
  const doc = section.doc ?? "ops";
  const title =
    documents.find((d) => d.id === doc)?.title ?? doc;
  return (
    <button
      onClick={() => onOpen(run, doc, sectionId)}
      className="font-mono text-xs text-sky-300 underline decoration-sky-400/50 underline-offset-2 hover:text-sky-200"
      title={`${title} › ${section.title}`}
    >
      Open {sectionId}
    </button>
  );
}

function HighlightedQuote({
  text,
  match,
  tone,
}: {
  text: string;
  match: string;
  tone: "rose" | "amber";
}) {
  const ex = excerpt(text, match);
  const cls =
    tone === "rose"
      ? "bg-rose-500/30 text-rose-100"
      : "bg-amber-500/25 text-amber-100";
  if (!ex) {
    return (
      <p className="text-sm">
        <span className={`rounded px-0.5 ${cls}`}>{match}</span>
      </p>
    );
  }
  return (
    <p className="text-sm leading-relaxed text-zinc-400">
      {ex.before}
      <span className={`rounded px-0.5 ${cls}`}>{ex.hit}</span>
      {ex.after}
    </p>
  );
}

export function MaintenanceTab({
  mutations,
  canon,
  documents,
  sectionsPsyche,
  sectionsBaseline,
  onOpenSection,
}: {
  mutations: MutationsFile;
  canon: CanonVersion[];
  documents: DocumentInfo[];
  sectionsPsyche: Section[];
  sectionsBaseline: Section[];
  onOpenSection: OpenSection;
}) {
  const latestFacts = useMemo(() => {
    const last = canon[canon.length - 1];
    return new Map((last?.facts ?? []).map((f) => [f.id, f]));
  }, [canon]);
  const oldValues = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const s of mutations.steps) {
      if (!map.has(s.fact)) map.set(s.fact, oldValueFor(s.fact, canon));
    }
    return map;
  }, [mutations, canon]);

  const staleData = useMemo(
    () =>
      mutations.steps.map((s) => ({
        step: s.step,
        psyche: s.engine.stale.length,
        baseline: s.baseline.stale.length,
      })),
    [mutations],
  );
  const rewriteData = useMemo(
    () =>
      mutations.steps.map((s) => ({
        step: s.step,
        psyche: s.engine.sections_changed,
        baseline: s.baseline.sections_changed,
      })),
    [mutations],
  );
  const costs = useMemo(() => {
    const sum = (pick: (s: (typeof mutations.steps)[number]) => number) =>
      mutations.steps.reduce((a, s) => a + pick(s), 0);
    return {
      psyche: sum((s) => s.engine.cost_usd),
      baseline: sum((s) => s.baseline.cost_usd),
    };
  }, [mutations]);

  const baselineStale = useMemo(() => {
    const seen = new Set<string>();
    const out: (typeof mutations.steps)[number]["baseline"]["stale"] = [];
    for (const s of mutations.steps) {
      for (const h of s.baseline.stale) {
        const key = `${h.section_id}|${h.fact_id}|${h.match}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push(h);
        }
      }
    }
    return out;
  }, [mutations]);
  const engineStaleCount = useMemo(
    () => mutations.steps.reduce((a, s) => a + s.engine.stale.length, 0),
    [mutations],
  );
  const baseSectionsById = useMemo(
    () => new Map(sectionsBaseline.map((s) => [s.id, s])),
    [sectionsBaseline],
  );
  const psySectionsById = useMemo(
    () => new Map(sectionsPsyche.map((s) => [s.id, s])),
    [sectionsPsyche],
  );
  const audit = mutations.final_audit;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex snap-x gap-3 overflow-x-auto pb-1">
        {mutations.steps.map((s) => (
          <StepCard
            key={s.step}
            step={s}
            fact={latestFacts.get(s.fact)}
            oldValue={oldValues.get(s.fact) ?? null}
            derivedFacts={latestFacts}
          />
        ))}
      </div>

      <div>
        <div className="mb-1 flex items-center gap-3">
          <h3 className="text-sm font-semibold text-zinc-200">
            Stale values left in the documents
          </h3>
          <Legend />
        </div>
        <ResponsiveContainer width="100%" height={170}>
          <LineChart
            data={staleData}
            margin={{ top: 4, right: 8, bottom: 0, left: -22 }}
          >
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
            <XAxis
              dataKey="step"
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: "#3f3f46" }}
              interval={0}
            />
            <YAxis
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: "#3f3f46" }}
              allowDecimals={false}
              width={36}
            />
            <Tooltip content={<StepTip />} />
            <Line
              type="monotone"
              dataKey="psyche"
              name="PsycheEngine"
              stroke={PSYCHE}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="baseline"
              name="Baseline"
              stroke={BASELINE}
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <div className="mb-1 flex items-center gap-3">
          <h3 className="text-sm font-semibold text-zinc-200">
            Sections rewritten per change
          </h3>
          <span className="ml-auto text-[11px] text-zinc-400">
            Total{" "}
            <span className="font-mono" style={{ color: PSYCHE }}>
              ${costs.psyche.toFixed(2)}
            </span>{" "}
            vs{" "}
            <span className="font-mono" style={{ color: BASELINE }}>
              ${costs.baseline.toFixed(2)}
            </span>
          </span>
        </div>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart
            data={rewriteData}
            margin={{ top: 4, right: 8, bottom: 0, left: -14 }}
            barGap={2}
          >
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
            <XAxis
              dataKey="step"
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: "#3f3f46" }}
              interval={0}
            />
            <YAxis
              tick={axisTick}
              tickLine={false}
              axisLine={{ stroke: "#3f3f46" }}
              allowDecimals={false}
              width={30}
            />
            <Tooltip content={<StepTip />} cursor={{ fill: "#27272a" }} />
            <Bar
              dataKey="psyche"
              name="PsycheEngine"
              fill={PSYCHE}
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey="baseline"
              name="Baseline"
              fill={BASELINE}
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-zinc-200">
          Still wrong after {mutations.steps.length} changes · Baseline
        </h3>
        {baselineStale.length === 0 &&
        audit.baseline.violations.length === 0 &&
        audit.baseline.contradictions.length === 0 ? (
          <p className="text-sm text-zinc-500">0 stale values.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {baselineStale.map((h, i) => (
              <div
                key={`${h.section_id}-${h.fact_id}-${i}`}
                className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3"
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant="danger">stale</Badge>
                  <Badge variant="outline" className="font-mono">
                    {h.fact_id}
                  </Badge>
                  <span className="ml-auto">
                    <SectionLink
                      run="baseline"
                      sectionId={h.section_id}
                      sections={sectionsBaseline}
                      documents={documents}
                      onOpen={onOpenSection}
                    />
                  </span>
                </div>
                <HighlightedQuote
                  text={
                    baseSectionsById.get(h.section_id)?.text ?? h.match
                  }
                  match={h.match}
                  tone="rose"
                />
              </div>
            ))}
            {audit.baseline.violations.map((v, i) => (
              <div
                key={`v-${i}`}
                className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3"
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant="warn">violation</Badge>
                  <Badge variant="outline" className="font-mono">
                    {v.fact_id}
                  </Badge>
                  <span className="ml-auto">
                    <SectionLink
                      run="baseline"
                      sectionId={v.section_id}
                      sections={sectionsBaseline}
                      documents={documents}
                      onOpen={onOpenSection}
                    />
                  </span>
                </div>
                <HighlightedQuote
                  text={
                    baseSectionsById.get(v.section_id)?.text ?? v.quote
                  }
                  match={v.quote}
                  tone="amber"
                />
                <p className="mt-1 text-xs text-zinc-400">{v.explanation}</p>
              </div>
            ))}
            {audit.baseline.contradictions.map((c, i) => (
              <div
                key={`c-${i}`}
                className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3"
              >
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Badge variant="danger">contradiction</Badge>
                  <Badge variant="outline">{c.category}</Badge>
                </div>
                <div className="flex flex-col gap-1.5">
                  {(
                    [
                      [c.section_a, c.quote_a],
                      [c.section_b, c.quote_b],
                    ] as const
                  ).map(([sid, q]) => (
                    <div key={sid}>
                      <HighlightedQuote
                        text={baseSectionsById.get(sid)?.text ?? q}
                        match={q}
                        tone="rose"
                      />
                      <SectionLink
                        run="baseline"
                        sectionId={sid}
                        sections={sectionsBaseline}
                        documents={documents}
                        onOpen={onOpenSection}
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-xs text-zinc-400">{c.explanation}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-zinc-200">
          PsycheEngine
        </h3>
        {engineStaleCount === 0 &&
        audit.engine.violations.length === 0 &&
        audit.engine.contradictions.length === 0 ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
            <p className="text-base text-emerald-200">0 stale values</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              Every change was applied everywhere it was needed.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {engineStaleCount === 0 && (
              <p className="text-sm text-emerald-200">0 stale values</p>
            )}
            {audit.engine.contradictions.map((c, i) => (
              <div
                key={`ec-${i}`}
                className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3"
              >
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Badge variant="danger">contradiction</Badge>
                  <Badge variant="outline">{c.category}</Badge>
                </div>
                <div className="flex flex-col gap-1.5">
                  {(
                    [
                      [c.section_a, c.quote_a],
                      [c.section_b, c.quote_b],
                    ] as const
                  ).map(([sid, q]) => (
                    <div key={sid}>
                      <HighlightedQuote
                        text={psySectionsById.get(sid)?.text ?? q}
                        match={q}
                        tone="rose"
                      />
                      <SectionLink
                        run="psyche"
                        sectionId={sid}
                        sections={sectionsPsyche}
                        documents={documents}
                        onOpen={onOpenSection}
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-xs text-zinc-400">{c.explanation}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

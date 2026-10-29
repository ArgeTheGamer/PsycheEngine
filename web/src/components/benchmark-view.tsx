"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useT } from "@/lib/i18n";
import type {
  AuditViolation,
  Contradiction,
  DocumentInfo,
  MutationAudit,
  RunId,
  Section,
} from "@/lib/types";
import { LocLabel } from "./shell";

function splitWithinBetween(
  contradictions: Contradiction[],
  docOf: Map<string, string>,
) {
  let within = 0;
  let between = 0;
  for (const c of contradictions) {
    const a = docOf.get(c.section_a);
    const b = docOf.get(c.section_b);
    if (a === undefined || b === undefined) continue;
    if (a === b) within += 1;
    else between += 1;
  }
  return { within, between };
}

function heatCounts(
  contradictions: Contradiction[],
  docOf: Map<string, string>,
  docs: DocumentInfo[],
) {
  const counts = new Map<string, number>();
  for (const c of contradictions) {
    const a = docOf.get(c.section_a);
    const b = docOf.get(c.section_b);
    if (a === undefined || b === undefined) continue;
    const key = [a, b].sort().join("|");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return docs.map((r) =>
    docs.map((col) => {
      const key = [r.id, col.id].sort().join("|");
      return counts.get(key) ?? 0;
    }),
  );
}

function cellClass(count: number): string {
  if (count >= 3) return "bg-hazard font-bold text-label";
  if (count >= 1) return "bg-hazard-soft font-bold text-hazard";
  return "bg-concrete text-ink-soft";
}

type TipEntry = {
  dataKey?: string | number;
  name?: string;
  value?: number | string;
};

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TipEntry[];
  label?: number | string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="border-[1.5px] border-ink bg-label px-3 py-2 text-[13px]">
      <div className="mb-1 font-mono text-[12px] text-ink-soft">{label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5"
            style={{
              background:
                p.dataKey === "psyche"
                  ? "var(--color-ink)"
                  : "var(--color-hazard)",
            }}
          />
          <span className="text-ink-soft">{p.name}</span>
          <span className="ml-auto pl-4 font-mono font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function ViolationCard({ v }: { v: AuditViolation }) {
  return (
    <li className="border-b border-rule px-5 py-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="bg-hazard px-1.5 py-0.5 font-mono text-[11px] uppercase text-label">
          {v.category}
        </span>
        <span className="font-mono text-[12px] text-ink-soft">{v.fact_id}</span>
      </div>
      <LocLabel id={v.section_id} size={12} />
      <span className="mt-1 block border-l-2 border-hazard pl-2 text-[13px] leading-snug">
        &ldquo;{v.quote}&rdquo;
      </span>
      <p className="mt-1 text-[12px] leading-snug text-ink-soft">
        {v.explanation}
      </p>
    </li>
  );
}

export function BenchmarkView({
  documents,
  sectionsPsyche,
  sectionsBaseline,
  contradictionsPsyche,
  contradictionsBaseline,
  auditPsyche,
  auditBaseline,
}: {
  documents: DocumentInfo[];
  sectionsPsyche: Section[];
  sectionsBaseline: Section[];
  contradictionsPsyche: Contradiction[];
  contradictionsBaseline: Contradiction[];
  auditPsyche: MutationAudit | null;
  auditBaseline: MutationAudit | null;
}) {
  const { t, tn } = useT();
  const [version, setVersion] = useState<RunId>("baseline");

  const docOfPsyche = useMemo(
    () => new Map(sectionsPsyche.map((s) => [s.id, s.doc ?? "ops"])),
    [sectionsPsyche],
  );
  const docOfBaseline = useMemo(
    () => new Map(sectionsBaseline.map((s) => [s.id, s.doc ?? "ops"])),
    [sectionsBaseline],
  );
  const psycheSplit = useMemo(
    () => splitWithinBetween(contradictionsPsyche, docOfPsyche),
    [contradictionsPsyche, docOfPsyche],
  );
  const baselineSplit = useMemo(
    () => splitWithinBetween(contradictionsBaseline, docOfBaseline),
    [contradictionsBaseline, docOfBaseline],
  );
  const bars = [
    {
      kind: t("prod.within"),
      psyche: psycheSplit.within,
      baseline: baselineSplit.within,
    },
    {
      kind: t("prod.between"),
      psyche: psycheSplit.between,
      baseline: baselineSplit.between,
    },
  ];
  const heat = useMemo(
    () =>
      heatCounts(
        version === "psyche" ? contradictionsPsyche : contradictionsBaseline,
        version === "psyche" ? docOfPsyche : docOfBaseline,
        documents,
      ),
    [
      version,
      contradictionsPsyche,
      contradictionsBaseline,
      docOfPsyche,
      docOfBaseline,
      documents,
    ],
  );
  const violations =
    version === "psyche"
      ? (auditPsyche?.violations ?? [])
      : (auditBaseline?.violations ?? []);

  const totals = [
    {
      id: "psyche" as RunId,
      label: t("ver.psyche"),
      total: psycheSplit.within + psycheSplit.between,
      between: psycheSplit.between,
    },
    {
      id: "baseline" as RunId,
      label: t("ver.baseline"),
      total: baselineSplit.within + baselineSplit.between,
      between: baselineSplit.between,
    },
  ];

  return (
    <div className="grid grid-cols-[280px_1fr_340px] max-xl:grid-cols-[240px_1fr] max-lg:grid-cols-1">
      {/* Headline counts */}
      <section className="border-r-[1.5px] border-ink bg-label max-lg:border-r-0 max-lg:border-b-[1.5px]">
        <div className="border-b-[1.5px] border-ink px-5 pb-4 pt-5">
          <h2 className="font-display text-[22px] font-semibold uppercase tracking-[0.04em]">
            {t("prod.issues")}
          </h2>
          {totals.map((v) => (
            <div key={v.id} className="mt-4">
              <div
                className={`stencil text-[72px] ${v.total > 0 ? "text-hazard" : "text-steady"}`}
              >
                {v.total}
              </div>
              <div className="mt-1 text-[13px] leading-snug text-ink-soft">
                {v.label} · {tn("n.contradictions", v.total)} {t("bench.total")}
                <br />
                {t("bench.of_which")} {v.between} {t("prod.between")}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-4">
          <div className="mb-2 font-display text-[15px] font-semibold uppercase tracking-[0.05em]">
            {t("bench.details")}
          </div>
          <div role="tablist" className="flex border-[1.5px] border-ink">
            {(["psyche", "baseline"] as RunId[]).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={version === v}
                onClick={() => setVersion(v)}
                className={`flex-1 px-3 py-2 font-display text-[15px] font-semibold uppercase tracking-[0.05em] ${
                  version === v ? "bg-ink text-label" : "hover:bg-concrete"
                }`}
              >
                {v === "psyche" ? t("ver.psyche") : t("ver.baseline")}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Bars and the doc × doc matrix */}
      <section className="min-w-0 px-6 py-5">
        <h3 className="font-display text-[18px] font-semibold uppercase tracking-[0.05em]">
          {t("bench.bars")}
        </h3>
        <div className="mb-3 mt-1 flex items-center gap-4 text-[12px] text-ink-soft">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 bg-ink" />
            {t("ver.psyche")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 bg-hazard" />
            {t("ver.baseline")}
          </span>
        </div>
        <div
          role="img"
          aria-label={`${t("bench.bars")}: ${t("ver.psyche")} ${psycheSplit.within} / ${psycheSplit.between}, ${t("ver.baseline")} ${baselineSplit.within} / ${baselineSplit.between}`}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bars} margin={{ top: 4, right: 8, bottom: 0, left: -8 }} barGap={3}>
              <XAxis
                dataKey="kind"
                tick={{ fill: "var(--color-ink-soft)", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-ink)" }}
                interval={0}
              />
              <YAxis
                tick={{ fill: "var(--color-ink-soft)", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-ink)" }}
                allowDecimals={false}
                width={30}
              />
              <Tooltip content={<ChartTip />} cursor={{ fill: "var(--color-concrete-deep)" }} />
              <Bar dataKey="psyche" name={t("ver.psyche")} fill="var(--color-ink)" />
              <Bar dataKey="baseline" name={t("ver.baseline")} fill="var(--color-hazard)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <h3 className="mt-6 font-display text-[18px] font-semibold uppercase tracking-[0.05em]">
          {t("bench.matrix")} ·{" "}
          {version === "psyche" ? t("ver.psyche") : t("ver.baseline")}
        </h3>
        <div
          className="mt-2 grid gap-1"
          style={{
            gridTemplateColumns: `auto repeat(${documents.length}, minmax(0, 1fr))`,
          }}
        >
          <span />
          {documents.map((d) => (
            <span
              key={d.id}
              title={d.title}
              className="truncate text-center font-mono text-[11px] text-ink-soft"
            >
              {d.id.toUpperCase()}
            </span>
          ))}
          {documents.map((row, i) => (
            <Fragment key={row.id}>
              <span
                title={row.title}
                className="truncate pr-1 text-right font-mono text-[11px] text-ink-soft"
              >
                {row.id.toUpperCase()}
              </span>
              {heat[i].map((count, j) => (
                <span
                  key={documents[j].id}
                  title={`${row.title} × ${documents[j].title}: ${count}`}
                  className={`px-1 py-1.5 text-center font-mono text-[13px] ${cellClass(count)}`}
                >
                  {count}
                </span>
              ))}
            </Fragment>
          ))}
        </div>
      </section>

      {/* Fact violations for the inspected version */}
      <aside className="border-l-[1.5px] border-ink bg-label max-xl:col-span-2 max-xl:border-l-0 max-xl:border-t-[1.5px] max-lg:col-span-1">
        <div className="border-b-[1.5px] border-ink px-5 pb-4 pt-5">
          <h2 className="font-display text-[22px] font-semibold uppercase tracking-[0.04em]">
            {t("bench.violations")}
          </h2>
          <p className="mt-1 text-[13px] text-ink-soft">
            {version === "psyche" ? t("ver.psyche") : t("ver.baseline")} ·{" "}
            {violations.length} {tn("n.violations", violations.length)}
          </p>
        </div>
        {violations.length === 0 ? (
          <p className="px-5 py-4 text-[14px] text-ink-soft">{t("prod.none")}</p>
        ) : (
          <ul>
            {violations.map((v, i) => (
              <ViolationCard key={`${v.section_id}-${v.fact_id}-${i}`} v={v} />
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

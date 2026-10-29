"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
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
  OpenSection,
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
import { useT } from "@/lib/i18n";
import { LocLabel } from "./shell";

const ABBR = [
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

function words(s: string): string {
  return s.replace(/_/g, " ");
}

function stepLabel(s: MutationStep): string {
  const m = parseMonth(s.notice);
  return m !== null ? ABBR[m] : `C${s.step}`;
}

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
  const { t, tn } = useT();
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
          : t("year.not_in_canon");
      return `${id}: ${change}`;
    })
    .join("\n");
  return (
    <div className="flex min-w-[250px] flex-1 snap-start flex-col gap-2 border-[1.5px] border-ink bg-label p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="bg-ink px-2 py-1 font-display text-[15px] font-semibold uppercase tracking-[0.05em] text-label">
          {monthIdx !== null ? MONTHS[monthIdx] : `${t("year.step")} ${step.step}`}
        </span>
        <span className="text-[12px] text-ink-soft">
          {t("year.change")} {stepIndex + 1}/{stepCount}
        </span>
        {factIds.length === 1 && (
          <span className="font-mono text-[12px] text-ink-soft">{factIds[0]}</span>
        )}
        {batch && (
          <span
            className="border border-rule bg-concrete px-1.5 py-0.5 text-[12px] font-medium"
            title={hoverList}
          >
            {factIds.length} {tn("n.facts_changed", factIds.length)}
          </span>
        )}
      </div>
      <p className="text-[14px] leading-snug">{step.notice}</p>
      {batch ? (
        <p className="text-[14px] font-semibold" title={hoverList}>
          {batchTitle(step.notice)}: {factIds.length}{" "}
          {tn("n.facts_changed", factIds.length)}
        </p>
      ) : (
        <p className="font-mono text-[13px]">
          {first ? (
            <>
              <span className="text-ink-soft">
                {words(first.subject)} {words(first.attribute)}{" "}
              </span>
              {oldValue !== null ? (
                <>
                  <span className="text-ink-soft line-through">{oldValue}</span>
                  <span className="text-ink-soft"> → </span>
                </>
              ) : null}
              <span className="font-bold">{first.value}</span>
              {first.unit ? <span className="text-ink-soft"> {first.unit}</span> : null}
            </>
          ) : (
            <span className="text-ink-soft">
              {factIds[0] ?? step.fact ?? t("year.unknown_fact")} ({t("year.not_in_canon")})
            </span>
          )}
        </p>
      )}
      {step.derived.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] tracking-wide text-ink-soft uppercase">
            {t("year.knockon")}
          </span>
          <div className="flex flex-wrap gap-1">
            {step.derived.map((d) => {
              const f = latest.get(d.fact_id);
              return (
                <span
                  key={d.fact_id}
                  title={d.fact_id}
                  className="border border-rule bg-concrete px-1.5 py-0.5 font-mono text-[12px]"
                >
                  {f ? `${words(f.subject)} ` : `${d.fact_id} `}
                  {d.old_value} → {d.new_value}
                  {f?.unit ? ` ${f.unit}` : ""}
                </span>
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
  const { t } = useT();
  if (!active || !payload?.length) return null;
  const colorOf = (key: string | number | undefined) =>
    key === "psyche" ? "var(--color-ink)" : "var(--color-hazard)";
  const nameOf = (key: string | number | undefined) =>
    key === "psyche"
      ? t("ver.psyche")
      : key === "perDoc"
        ? t("ver.baseline_perdoc")
        : t("ver.baseline_ctx");
  return (
    <div className="border-[1.5px] border-ink bg-label px-3 py-2 text-[13px]">
      <div className="mb-1 font-mono text-[12px] text-ink-soft">{label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5"
            style={{ background: colorOf(p.dataKey) }}
          />
          <span className="text-ink-soft">{nameOf(p.dataKey)}:</span>
          <span className="ml-auto pl-4 font-mono font-semibold">{p.value}</span>
        </div>
      ))}
      {money.map(([name, usd]) => (
        <div key={name} className="mt-0.5 flex items-center gap-2">
          <span className="text-ink-soft">
            {t("usage.cost")} {name}:
          </span>
          <span className="ml-auto pl-4 font-mono font-semibold">
            ${usd.toFixed(2)}
          </span>
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
      <mark className="bg-hazard-soft px-0.5 underline decoration-hazard decoration-2 underline-offset-4">
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
  if (!onOpen || !s)
    return (
      <span className="font-mono text-[12px] text-ink-soft">
        {s ? `${s.chapter_title} › ${s.title}` : sectionId}
      </span>
    );
  return (
    <button
      type="button"
      onClick={() => onOpen("baseline", s.doc, s.id)}
      className="underline decoration-rule underline-offset-2 hover:decoration-ink"
      title={`${s.chapter_title} › ${s.title}`}
    >
      <LocLabel id={s.id} size={12} />
    </button>
  );
}

export function YearTab({
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
  const { t, tn } = useT();
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
    [mutations],
  );

  const staleData = useMemo(
    () =>
      mutations.steps.map((s) => ({
        step: stepLabel(s),
        psyche: s.engine.stale.length,
        baseline: s.baseline.stale.length,
        ...(s.baseline_per_doc
          ? { perDoc: s.baseline_per_doc.stale.length }
          : {}),
      })),
    [mutations],
  );

  const rewriteData = useMemo(
    () =>
      mutations.steps.map((s) => ({
        step: stepLabel(s),
        psyche: s.engine.sections_changed,
        baseline: s.baseline.sections_changed,
        ...(s.baseline_per_doc
          ? { perDoc: s.baseline_per_doc.sections_changed }
          : {}),
      })),
    [mutations],
  );

  const totals = useMemo(() => {
    const x = { psyche: 0, baseline: 0, perDoc: 0 };
    for (const s of mutations.steps) {
      x.psyche += s.engine.cost_usd;
      x.baseline += s.baseline.cost_usd;
      x.perDoc += s.baseline_per_doc?.cost_usd ?? 0;
    }
    return x;
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
    const titleFor = (label: string) =>
      `${t("year.still_wrong")} ${mutations.steps.length} ${tn("n.changes", mutations.steps.length)} — ${label}`;
    return [
      {
        key: "baseline",
        title: titleFor(t("ver.baseline_ctx")),
        sections: sectionsBaseline,
        stale: staleBy((s) => s.baseline),
        audit: mutations.final_audit.baseline,
      },
      ...(hasPerDoc
        ? [
            {
              key: "perDoc",
              title: titleFor(t("ver.baseline_perdoc")),
              sections: sectionsBaseline,
              stale: staleBy(
                (s) => s.baseline_per_doc ?? { ...s.baseline, stale: [] },
              ),
              audit: mutations.final_audit.baseline_per_doc,
            },
          ]
        : []),
      {
        key: "psyche",
        title: titleFor(t("ver.psyche")),
        sections: sectionsPsyche,
        stale: staleBy((s) => s.engine),
        audit: mutations.final_audit.engine,
      },
    ];
  }, [mutations, sectionsBaseline, sectionsPsyche, hasPerDoc, t, tn]);

  const legend = [
    { key: "psyche", label: t("ver.psyche"), dashed: false },
    { key: "baseline", label: t("ver.baseline_ctx"), dashed: false },
    ...(hasPerDoc
      ? [{ key: "perDoc", label: t("ver.baseline_perdoc"), dashed: true }]
      : []),
  ];

  return (
    <div>
      <div className="flex snap-x gap-3 overflow-x-auto border-b-[1.5px] border-ink p-4">
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

      <div className="grid grid-cols-2 gap-0 max-xl:grid-cols-1">
        <section className="border-b-[1.5px] border-ink px-6 py-5 xl:border-r-[1.5px]">
          <h3 className="font-display text-[18px] font-semibold uppercase tracking-[0.05em]">
            {t("year.stale_chart")}
          </h3>
          <div className="mb-2 mt-1 flex flex-wrap items-center gap-4 text-[12px] text-ink-soft">
            {legend.map((l) => (
              <span key={l.key} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-0 w-6 border-t-[3px]"
                  style={{
                    borderColor:
                      l.key === "psyche"
                        ? "var(--color-ink)"
                        : "var(--color-hazard)",
                    borderTopStyle: l.dashed ? "dashed" : "solid",
                  }}
                />
                {l.label}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={staleData} margin={{ left: -12, right: 8, top: 4 }}>
              <XAxis
                dataKey="step"
                tick={{ fill: "var(--color-ink-soft)", fontSize: 11 }}
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
              <Tooltip
                content={
                  <StepTip
                    money={[
                      [t("ver.psyche"), totals.psyche],
                      [t("ver.baseline_ctx"), totals.baseline],
                      ...(hasPerDoc
                        ? [[t("ver.baseline_perdoc"), totals.perDoc] as [string, number]]
                        : []),
                    ]}
                  />
                }
              />
              <Line
                type="monotone"
                dataKey="psyche"
                stroke="var(--color-ink)"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="baseline"
                stroke="var(--color-hazard)"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
              {hasPerDoc && (
                <Line
                  type="monotone"
                  dataKey="perDoc"
                  stroke="var(--color-hazard)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 3 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </section>

        <section className="border-b-[1.5px] border-ink px-6 py-5">
          <h3 className="font-display text-[18px] font-semibold uppercase tracking-[0.05em]">
            {t("year.rewrite_chart")}
          </h3>
          <div className="mb-2 mt-1 flex flex-wrap items-center gap-4 text-[12px] text-ink-soft">
            <span>
              {t("usage.cost")} {t("ver.psyche")}:{" "}
              <span className="font-mono text-ink">${totals.psyche.toFixed(2)}</span>
            </span>
            <span>
              {t("usage.cost")} {t("ver.baseline_ctx")}:{" "}
              <span className="font-mono text-ink">${totals.baseline.toFixed(2)}</span>
            </span>
            {hasPerDoc && (
              <span>
                {t("usage.cost")} {t("ver.baseline_perdoc")}:{" "}
                <span className="font-mono text-ink">${totals.perDoc.toFixed(2)}</span>
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={rewriteData} margin={{ left: -12, right: 8, top: 4 }} barGap={2}>
              <XAxis
                dataKey="step"
                tick={{ fill: "var(--color-ink-soft)", fontSize: 11 }}
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
              <Tooltip
                cursor={{ fill: "var(--color-concrete-deep)" }}
                content={<StepTip money={[]} />}
              />
              <Bar dataKey="psyche" fill="var(--color-ink)" />
              <Bar dataKey="baseline" fill="var(--color-hazard)" />
              {hasPerDoc && (
                <Bar dataKey="perDoc" fill="var(--color-hazard)" fillOpacity={0.45} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      {versions.map((v, vi) => {
        const violations = v.audit?.violations ?? [];
        const contras = v.audit?.contradictions ?? [];
        const clean =
          v.stale.length === 0 && violations.length === 0 && contras.length === 0;
        return (
          <section
            key={v.key}
            className={vi < versions.length - 1 ? "border-b-[1.5px] border-ink" : ""}
          >
            <div className="border-b border-rule bg-label px-6 py-4">
              <h3 className="font-display text-[20px] font-semibold uppercase tracking-[0.03em]">
                {v.title}
              </h3>
            </div>
            {clean ? (
              <div className="px-6 py-6 text-center">
                <p className="font-display text-[26px] font-semibold uppercase tracking-[0.03em] text-steady">
                  0 {tn("n.stale", 0)}
                </p>
                <p className="mt-1 text-[14px] text-ink-soft">{t("year.clean_sub")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 2xl:grid-cols-3">
                {v.stale.map((h) => {
                  const sec = v.sections.find((x) => x.id === h.section_id);
                  return (
                    <div
                      key={`${h.section_id}::${h.match}`}
                      className="border-[1.5px] border-ink bg-label p-4"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
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
                      <div className="mt-2">
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
                    className="border-[1.5px] border-hazard bg-label p-4"
                  >
                    <div className="mb-2">
                      <span className="bg-hazard px-1.5 py-0.5 font-mono text-[11px] uppercase text-label">
                        {t("year.audit_violation")}
                      </span>
                    </div>
                    <p className="font-mono text-[12px] text-ink-soft">
                      {x.fact_id} · {x.category}
                    </p>
                    <p className="mt-1 border-l-2 border-hazard pl-2 text-[14px]">
                      &ldquo;{x.quote}&rdquo;
                    </p>
                    <p className="mt-1 text-[13px] text-ink-soft">{x.explanation}</p>
                    <div className="mt-2">
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
                    className="border-[1.5px] border-hazard bg-label p-4"
                  >
                    <div className="mb-2">
                      <span className="bg-hazard px-1.5 py-0.5 font-mono text-[11px] uppercase text-label">
                        {tn("n.contradictions", 1)}
                      </span>
                    </div>
                    <p className="text-[14px]">
                      &ldquo;{c.quote_a}&rdquo;{" "}
                      <span className="text-ink-soft">{t("year.vs")}</span>{" "}
                      &ldquo;{c.quote_b}&rdquo;
                    </p>
                    <p className="mt-1 text-[13px] text-ink-soft">{c.explanation}</p>
                    <p className="mt-1 font-mono text-[12px] text-ink-soft">
                      {docTitle(c.section_a.split(".")[0])} · {c.section_a}
                      {" ↔ "}
                      {docTitle(c.section_b.split(".")[0])} · {c.section_b}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

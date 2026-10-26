"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  CallRecord,
  Contradiction,
  DocumentInfo,
  RunId,
  Section,
} from "@/lib/types";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "./ui";
import { cn } from "@/lib/utils";

const PSYCHE = "#34d399";
const BASELINE = "#fb7185";

function docMaps(sectionsPsyche: Section[], sectionsBaseline: Section[]) {
  const psyche = new Map(sectionsPsyche.map((s) => [s.id, s.doc ?? "ops"]));
  const baseline = new Map(
    sectionsBaseline.map((s) => [s.id, s.doc ?? "ops"]),
  );
  return { psyche, baseline };
}

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

function costPerDoc(calls: CallRecord[], docs: DocumentInfo[]) {
  const perDoc = new Map(docs.map((d) => [d.id, 0]));
  let untagged = 0;
  for (const c of calls) {
    const d = c.tags?.doc;
    if (d !== undefined && perDoc.has(d)) {
      perDoc.set(d, (perDoc.get(d) ?? 0) + c.cost_usd);
    } else {
      untagged += c.cost_usd;
    }
  }
  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  return {
    perDoc: docs.map((d) => round(perDoc.get(d.id) ?? 0)),
    untagged: round(untagged),
  };
}

type TipEntry = {
  dataKey?: string | number;
  name?: string;
  value?: number | string;
  color?: string;
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
    <div className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs shadow-xl">
      <div className="mb-1 font-mono text-zinc-400">{label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ background: p.color ?? "#888" }}
          />
          <span className="text-zinc-400">{p.name}</span>
          <span className="ml-auto pl-3 font-mono">
            {typeof p.value === "number"
              ? p.dataKey === "psycheCost" || p.dataKey === "baselineCost"
                ? `$${p.value.toFixed(4)}`
                : p.value
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

const axisTick = { fill: "#a1a1aa", fontSize: 10 };

function cellBg(count: number): string {
  if (count >= 3) return "bg-rose-500/70 text-rose-50";
  if (count === 2) return "bg-rose-500/45 text-rose-100";
  if (count === 1) return "bg-rose-500/25 text-rose-200";
  return "bg-zinc-900 text-zinc-600";
}

export function ChartsPanel({
  documents,
  sectionsPsyche,
  sectionsBaseline,
  contradictionsPsyche,
  contradictionsBaseline,
  callsPsyche,
  callsBaseline,
}: {
  documents: DocumentInfo[];
  sectionsPsyche: Section[];
  sectionsBaseline: Section[];
  contradictionsPsyche: Contradiction[];
  contradictionsBaseline: Contradiction[];
  callsPsyche: CallRecord[];
  callsBaseline: CallRecord[];
}) {
  const [version, setVersion] = useState<RunId>("baseline");

  const maps = useMemo(
    () => docMaps(sectionsPsyche, sectionsBaseline),
    [sectionsPsyche, sectionsBaseline],
  );
  const contraData = useMemo(() => {
    const p = splitWithinBetween(contradictionsPsyche, maps.psyche);
    const b = splitWithinBetween(contradictionsBaseline, maps.baseline);
    return [
      { kind: "within a document", psyche: p.within, baseline: b.within },
      { kind: "between documents", psyche: p.between, baseline: b.between },
    ];
  }, [contradictionsPsyche, contradictionsBaseline, maps]);
  const heat = useMemo(
    () =>
      heatCounts(
        version === "psyche" ? contradictionsPsyche : contradictionsBaseline,
        version === "psyche" ? maps.psyche : maps.baseline,
        documents,
      ),
    [version, contradictionsPsyche, contradictionsBaseline, maps, documents],
  );
  const costs = useMemo(
    () => ({
      psyche: costPerDoc(callsPsyche, documents),
      baseline: costPerDoc(callsBaseline, documents),
    }),
    [callsPsyche, callsBaseline, documents],
  );
  const costData = useMemo(
    () =>
      documents.map((d, i) => ({
        doc: d.id.toUpperCase(),
        psycheCost: costs.psyche.perDoc[i],
        baselineCost: costs.baseline.perDoc[i],
      })),
    [documents, costs],
  );
  const totals = useMemo(
    () => ({
      psycheCost: callsPsyche.reduce((a, c) => a + c.cost_usd, 0),
      baselineCost: callsBaseline.reduce((a, c) => a + c.cost_usd, 0),
    }),
    [callsPsyche, callsBaseline],
  );

  return (
    <Card className="min-h-[440px] xl:h-[calc((100vh-112px)/2)] xl:min-h-[400px]">
      <CardHeader>
        <CardTitle>Benchmark</CardTitle>
        <div className="ml-auto flex items-center gap-1.5">
          <Badge variant="danger">
            {contradictionsBaseline.length} baseline contradictions
          </Badge>
          <Badge variant="default">
            {contradictionsPsyche.length} PsycheEngine
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 gap-3 overflow-auto">
        <div className="min-h-[170px]">
          <div className="mb-1 flex items-center gap-3">
            <h3 className="text-xs font-semibold text-zinc-300">
              Contradictions
            </h3>
            <span className="ml-auto flex items-center gap-3 text-[11px] text-zinc-400">
              <span className="flex items-center gap-1">
                <span
                  className="size-2 rounded-full"
                  style={{ background: PSYCHE }}
                />
                PsycheEngine
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="size-2 rounded-full"
                  style={{ background: BASELINE }}
                />
                Baseline
              </span>
            </span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart
              data={contraData}
              margin={{ top: 4, right: 8, bottom: 0, left: -14 }}
              barGap={2}
            >
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis
                dataKey="kind"
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
              <Tooltip content={<ChartTip />} cursor={{ fill: "#27272a" }} />
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
          <div className="mb-1 flex items-center gap-2">
            <h3 className="text-xs font-semibold text-zinc-300">
              Between which documents
            </h3>
            <div className="ml-auto flex gap-1 rounded-md bg-zinc-800/70 p-0.5">
              {(["psyche", "baseline"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVersion(v)}
                  className={cn(
                    "rounded px-2 py-0.5 text-[11px] font-medium outline-none",
                    version === v
                      ? "bg-zinc-950 text-zinc-100 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200",
                  )}
                >
                  {v === "psyche" ? "PsycheEngine" : "Baseline"}
                </button>
              ))}
            </div>
          </div>
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `auto repeat(${documents.length}, minmax(0, 1fr))`,
            }}
          >
            <span />
            {documents.map((d) => (
              <span
                key={d.id}
                title={d.title}
                className="truncate text-center font-mono text-[10px] text-zinc-500"
              >
                {d.id.toUpperCase()}
              </span>
            ))}
            {documents.map((row, i) => (
              <Fragment key={row.id}>
                <span
                  title={row.title}
                  className="truncate pr-1 text-right font-mono text-[10px] text-zinc-500"
                >
                  {row.id.toUpperCase()}
                </span>
                {heat[i].map((count, j) => (
                  <span
                    key={documents[j].id}
                    title={`${row.title} × ${documents[j].title}: ${count}`}
                    className={cn(
                      "rounded px-1 py-1 text-center font-mono text-xs",
                      cellBg(count),
                    )}
                  >
                    {count}
                  </span>
                ))}
              </Fragment>
            ))}
          </div>
        </div>

        <div className="min-h-[170px]">
          <div className="mb-1 flex items-center gap-3">
            <h3 className="text-xs font-semibold text-zinc-300">
              Cost per document (USD)
            </h3>
            <span className="ml-auto text-[11px] text-zinc-400">
              Total{" "}
              <span className="font-mono" style={{ color: PSYCHE }}>
                ${totals.psycheCost.toFixed(3)}
              </span>{" "}
              vs{" "}
              <span className="font-mono" style={{ color: BASELINE }}>
                ${totals.baselineCost.toFixed(3)}
              </span>
            </span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart
              data={costData}
              margin={{ top: 4, right: 8, bottom: 0, left: -8 }}
              barGap={1}
            >
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis
                dataKey="doc"
                tick={axisTick}
                tickLine={false}
                axisLine={{ stroke: "#3f3f46" }}
                interval={0}
              />
              <YAxis
                tick={axisTick}
                tickLine={false}
                axisLine={{ stroke: "#3f3f46" }}
                width={44}
                tickFormatter={(v: number) => `$${v.toFixed(3)}`}
              />
              <Tooltip content={<ChartTip />} cursor={{ fill: "#27272a" }} />
              <Bar
                dataKey="psycheCost"
                name="PsycheEngine"
                fill={PSYCHE}
                radius={[2, 2, 0, 0]}
              />
              <Bar
                dataKey="baselineCost"
                name="Baseline"
                fill={BASELINE}
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          {(costs.psyche.untagged > 0 || costs.baseline.untagged > 0) && (
            <p className="mt-1 text-[11px] text-zinc-500">
              Excludes untagged planning/audit calls:{" "}
              <span className="font-mono" style={{ color: PSYCHE }}>
                ${costs.psyche.untagged.toFixed(4)}
              </span>{" "}
              PsycheEngine ·{" "}
              <span className="font-mono" style={{ color: BASELINE }}>
                ${costs.baseline.untagged.toFixed(4)}
              </span>{" "}
              Baseline
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

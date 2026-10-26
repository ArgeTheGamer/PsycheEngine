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
import type { CallRecord, Contradiction, Section } from "@/lib/types";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "./ui";

const PSYCHE = "#34d399";
const BASELINE = "#fb7185";

function cumulative(
  contradictions: Contradiction[],
  chapters: number,
  chapterOf: (sectionId: string) => number,
): number[] {
  const perChapter = new Array<number>(chapters + 1).fill(0);
  for (const c of contradictions) {
    const ch = Math.max(
      chapterOf(c.section_a),
      chapterOf(c.section_b),
    );
    if (ch >= 1 && ch <= chapters) perChapter[ch] += 1;
  }
  const out: number[] = [];
  let acc = 0;
  for (let ch = 1; ch <= chapters; ch++) {
    acc += perChapter[ch];
    out.push(acc);
  }
  return out;
}

function splitCalls(calls: CallRecord[], chapters: number) {
  const perChapter = new Array<number>(chapters).fill(0);
  let untagged = 0;
  for (const c of calls) {
    const ch = c.tags?.chapter;
    if (ch !== undefined && ch >= 1 && ch <= chapters) {
      perChapter[ch - 1] += c.cost_usd;
    } else {
      untagged += c.cost_usd;
    }
  }
  return {
    perChapter: perChapter.map((v) => Math.round(v * 1e6) / 1e6),
    untagged: Math.round(untagged * 1e6) / 1e6,
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
      <div className="mb-1 font-mono text-zinc-400">Ch {label}</div>
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

export function ChartsPanel({
  sectionsPsyche,
  sectionsBaseline,
  contradictionsPsyche,
  contradictionsBaseline,
  callsPsyche,
  callsBaseline,
}: {
  sectionsPsyche: Section[];
  sectionsBaseline: Section[];
  contradictionsPsyche: Contradiction[];
  contradictionsBaseline: Contradiction[];
  callsPsyche: CallRecord[];
  callsBaseline: CallRecord[];
}) {
  const chapterById = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of [...sectionsPsyche, ...sectionsBaseline]) {
      map.set(s.id, s.chapter);
    }
    return map;
  }, [sectionsPsyche, sectionsBaseline]);
  const chapters = useMemo(
    () =>
      chapterById.size === 0
        ? 0
        : Math.max(...chapterById.values()),
    [chapterById],
  );
  const chapterOf = useMemo(
    () => (sectionId: string) => chapterById.get(sectionId) ?? 0,
    [chapterById],
  );
  const lineData = useMemo(() => {
    const p = cumulative(contradictionsPsyche, chapters, chapterOf);
    const b = cumulative(contradictionsBaseline, chapters, chapterOf);
    return p.map((v, i) => ({ chapter: i + 1, psyche: v, baseline: b[i] }));
  }, [contradictionsPsyche, contradictionsBaseline, chapters, chapterOf]);
  const costs = useMemo(
    () => ({
      psyche: splitCalls(callsPsyche, chapters),
      baseline: splitCalls(callsBaseline, chapters),
    }),
    [callsPsyche, callsBaseline, chapters],
  );
  const barData = useMemo(
    () =>
      costs.psyche.perChapter.map((v, i) => ({
        chapter: i + 1,
        psycheCost: v,
        baselineCost: costs.baseline.perChapter[i],
      })),
    [costs],
  );
  const totals = useMemo(
    () => ({
      psycheCost: callsPsyche.reduce((a, c) => a + c.cost_usd, 0),
      baselineCost: callsBaseline.reduce((a, c) => a + c.cost_usd, 0),
    }),
    [callsPsyche, callsBaseline],
  );

  if (chapters === 0) {
    return (
      <Card className="min-h-[440px] xl:h-[calc((100vh-112px)/2)] xl:min-h-[400px]">
        <CardHeader>
          <CardTitle>Benchmark</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-zinc-500">No sections in this run.</p>
        </CardContent>
      </Card>
    );
  }

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
      <CardContent className="min-h-0 flex-1 gap-2 overflow-auto">
        <div className="min-h-[190px] flex-1">
          <div className="mb-1 flex items-center gap-3">
            <h3 className="text-xs font-semibold text-zinc-300">
              Cumulative contradictions per chapter
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
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={lineData} margin={{ top: 4, right: 8, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis dataKey="chapter" tick={axisTick} tickLine={false} axisLine={{ stroke: "#3f3f46" }} interval={0} />
              <YAxis tick={axisTick} tickLine={false} axisLine={{ stroke: "#3f3f46" }} allowDecimals={false} width={30} />
              <Tooltip content={<ChartTip />} />
              <Line type="monotone" dataKey="psyche" name="PsycheEngine" stroke={PSYCHE} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="baseline" name="Baseline" stroke={BASELINE} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="min-h-[190px] flex-1">
          <div className="mb-1 flex items-center gap-3">
            <h3 className="text-xs font-semibold text-zinc-300">
              Cost per chapter (USD)
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
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }} barGap={1}>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis dataKey="chapter" tick={axisTick} tickLine={false} axisLine={{ stroke: "#3f3f46" }} interval={0} />
              <YAxis tick={axisTick} tickLine={false} axisLine={{ stroke: "#3f3f46" }} width={44} tickFormatter={(v: number) => `$${v.toFixed(3)}`} />
              <Tooltip content={<ChartTip />} cursor={{ fill: "#27272a" }} />
              <Bar dataKey="psycheCost" name="PsycheEngine" fill={PSYCHE} radius={[2, 2, 0, 0]} />
              <Bar dataKey="baselineCost" name="Baseline" fill={BASELINE} radius={[2, 2, 0, 0]} />
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

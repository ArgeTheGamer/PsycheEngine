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
  type TooltipProps,
} from "recharts";
import type { CallRecord, Contradiction, Section } from "@/lib/types";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "./ui";

const PSYCHE = "#34d399";
const BASELINE = "#fb7185";

function chapterOf(sectionId: string): number {
  const m = /-ch(\d+)$/.exec(sectionId);
  return m ? parseInt(m[1], 10) : 0;
}

function cumulative(
  contradictions: Contradiction[],
  chapters: number,
): number[] {
  const perChapter = new Array<number>(chapters + 1).fill(0);
  for (const c of contradictions) {
    const ch = Math.max(chapterOf(c.section_a), chapterOf(c.section_b));
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

function costPerChapter(calls: CallRecord[], chapters: number): number[] {
  const out = new Array<number>(chapters).fill(0);
  for (const c of calls) {
    const ch = c.tags.chapter;
    if (ch !== undefined && ch >= 1 && ch <= chapters) out[ch - 1] += c.cost_usd;
  }
  return out.map((v) => Math.round(v * 1e6) / 1e6);
}

function ChartTip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs shadow-xl">
      <div className="mb-1 font-mono text-zinc-400">Ch {label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ background: String(p.color ?? p.payload?.fill ?? "#888") }}
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
  sections,
  contradictionsPsyche,
  contradictionsBaseline,
  callsPsyche,
  callsBaseline,
}: {
  sections: Section[];
  contradictionsPsyche: Contradiction[];
  contradictionsBaseline: Contradiction[];
  callsPsyche: CallRecord[];
  callsBaseline: CallRecord[];
}) {
  const chapters = sections.length;
  const lineData = useMemo(() => {
    const p = cumulative(contradictionsPsyche, chapters);
    const b = cumulative(contradictionsBaseline, chapters);
    return p.map((v, i) => ({ chapter: i + 1, psyche: v, baseline: b[i] }));
  }, [contradictionsPsyche, contradictionsBaseline, chapters]);
  const barData = useMemo(() => {
    const p = costPerChapter(callsPsyche, chapters);
    const b = costPerChapter(callsBaseline, chapters);
    return p.map((v, i) => ({
      chapter: i + 1,
      psycheCost: v,
      baselineCost: b[i],
    }));
  }, [callsPsyche, callsBaseline, chapters]);
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
        </div>
      </CardContent>
    </Card>
  );
}

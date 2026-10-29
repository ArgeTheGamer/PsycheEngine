"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useT, type Lang } from "@/lib/i18n";
import type { CallRecord, DocumentInfo } from "@/lib/types";

type Cell = { cost: number; tokens: number };
const ZERO: Cell = { cost: 0, tokens: 0 };

function tokensOf(c: CallRecord): number {
  return c.prompt_tokens + c.completion_tokens;
}

function sum(calls: CallRecord[]): Cell {
  let cost = 0;
  let tokens = 0;
  for (const c of calls) {
    cost += c.cost_usd;
    tokens += tokensOf(c);
  }
  return { cost, tokens };
}

function fmtTokens(n: number, lang: Lang): string {
  return n.toLocaleString(lang === "pl" ? "pl-PL" : "en-US");
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
                  : "var(--color-ink-soft)",
            }}
          />
          <span className="text-ink-soft">{p.name}</span>
          <span className="ml-auto pl-4 font-mono font-semibold">
            {typeof p.value === "number" ? `$${p.value.toFixed(4)}` : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function Money({ v, exact }: { v: number; exact?: boolean }) {
  return <span>${v.toFixed(exact ? 4 : 2)}</span>;
}

export function UsageView({
  documents,
  callsPsyche,
  callsBaseline,
}: {
  documents: DocumentInfo[];
  callsPsyche: CallRecord[];
  callsBaseline: CallRecord[];
}) {
  const { t, lang } = useT();

  const model = useMemo(() => {
    const perDoc = new Map<string, { psyche: Cell; baseline: Cell }>();
    for (const d of documents) {
      perDoc.set(d.id, {
        psyche: { ...ZERO },
        baseline: { ...ZERO },
      });
    }
    const untagged = { psyche: { ...ZERO }, baseline: { ...ZERO } };
    const add = (
      calls: CallRecord[],
      key: "psyche" | "baseline",
      agents: Map<string, Cell>,
    ) => {
      for (const c of calls) {
        const cell = { cost: c.cost_usd, tokens: tokensOf(c) };
        const slot = perDoc.get(c.tags?.doc ?? "");
        if (slot) {
          slot[key].cost += cell.cost;
          slot[key].tokens += cell.tokens;
        } else {
          untagged[key].cost += cell.cost;
          untagged[key].tokens += cell.tokens;
        }
        const a = agents.get(c.agent) ?? { ...ZERO };
        a.cost += cell.cost;
        a.tokens += cell.tokens;
        agents.set(c.agent, a);
      }
    };
    const agentsPsyche = new Map<string, Cell>();
    const agentsBaseline = new Map<string, Cell>();
    add(callsPsyche, "psyche", agentsPsyche);
    add(callsBaseline, "baseline", agentsBaseline);
    const agents = [...new Set([...agentsPsyche.keys(), ...agentsBaseline.keys()])].sort();
    return {
      perDoc,
      untagged,
      agents,
      agentsPsyche,
      agentsBaseline,
      totalPsyche: sum(callsPsyche),
      totalBaseline: sum(callsBaseline),
    };
  }, [documents, callsPsyche, callsBaseline]);

  const chartData = useMemo(
    () =>
      documents.map((d) => ({
        doc: d.id.toUpperCase(),
        psyche: Math.round((model.perDoc.get(d.id)?.psyche.cost ?? 0) * 1e6) / 1e6,
        baseline:
          Math.round((model.perDoc.get(d.id)?.baseline.cost ?? 0) * 1e6) / 1e6,
      })),
    [documents, model],
  );

  const th =
    "border-b-[1.5px] border-ink px-2 py-1.5 text-left font-display text-[13px] font-semibold uppercase tracking-[0.06em]";
  const thNum = `${th} text-right`;
  const td = "border-b border-rule px-2 py-1.5 font-mono text-[12px] tabular-nums";
  const tdNum = `${td} text-right`;

  return (
    <div className="grid grid-cols-[280px_1fr] max-lg:grid-cols-1">
      <section className="border-r-[1.5px] border-ink bg-label max-lg:border-r-0 max-lg:border-b-[1.5px]">
        <div className="border-b-[1.5px] border-ink px-5 pb-4 pt-5">
          <h2 className="font-display text-[22px] font-semibold uppercase tracking-[0.04em]">
            {t("usage.totals")}
          </h2>
          {[
            { label: t("ver.psyche"), cell: model.totalPsyche },
            { label: t("ver.baseline"), cell: model.totalBaseline },
          ].map((v) => (
            <div key={v.label} className="mt-4">
              <div className="font-display text-[15px] font-semibold uppercase tracking-[0.05em]">
                {v.label}
              </div>
              <div className="mt-1 font-mono text-[30px] font-semibold leading-none tabular-nums">
                <Money v={v.cell.cost} />
              </div>
              <div className="mt-1 font-mono text-[14px] tabular-nums text-ink-soft">
                {fmtTokens(v.cell.tokens, lang)} {t("usage.tokens").toLowerCase()}
              </div>
            </div>
          ))}
        </div>
        <p className="px-5 py-4 text-[13px] leading-snug text-ink-soft">
          {t("usage.untagged")}
        </p>
      </section>

      <section className="min-w-0 px-6 py-5">
        <div className="grid gap-8 2xl:grid-cols-2">
          <div>
            <h3 className="font-display text-[18px] font-semibold uppercase tracking-[0.05em]">
              {t("usage.per_doc")}
            </h3>
            <table className="mt-2 w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>{t("usage.document")}</th>
                  <th className={thNum} colSpan={2}>
                    {t("ver.psyche")}
                  </th>
                  <th className={thNum} colSpan={2}>
                    {t("ver.baseline")}
                  </th>
                </tr>
                <tr>
                  <th className={th} />
                  <th className={thNum}>{t("usage.cost")}</th>
                  <th className={thNum}>{t("usage.tokens")}</th>
                  <th className={thNum}>{t("usage.cost")}</th>
                  <th className={thNum}>{t("usage.tokens")}</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => {
                  const slot = model.perDoc.get(d.id) ?? {
                    psyche: ZERO,
                    baseline: ZERO,
                  };
                  return (
                    <tr key={d.id}>
                      <td className={`${td} font-sans`} title={d.title}>
                        <span className="font-mono font-semibold">{d.id.toUpperCase()}</span>{" "}
                        <span className="text-ink-soft">{d.title}</span>
                      </td>
                      <td className={tdNum}>
                        <Money v={slot.psyche.cost} exact />
                      </td>
                      <td className={tdNum}>{fmtTokens(slot.psyche.tokens, lang)}</td>
                      <td className={tdNum}>
                        <Money v={slot.baseline.cost} exact />
                      </td>
                      <td className={tdNum}>{fmtTokens(slot.baseline.tokens, lang)}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td className={`${td} font-sans italic text-ink-soft`}>{t("usage.not_tagged")}</td>
                  <td className={tdNum}>
                    <Money v={model.untagged.psyche.cost} exact />
                  </td>
                  <td className={tdNum}>{fmtTokens(model.untagged.psyche.tokens, lang)}</td>
                  <td className={tdNum}>
                    <Money v={model.untagged.baseline.cost} exact />
                  </td>
                  <td className={tdNum}>{fmtTokens(model.untagged.baseline.tokens, lang)}</td>
                </tr>
                <tr>
                  <td className={`${td} border-b-0 font-sans font-semibold`}>{t("usage.total")}</td>
                  <td className={`${tdNum} border-b-0 font-semibold`}>
                    <Money v={model.totalPsyche.cost} exact />
                  </td>
                  <td className={`${tdNum} border-b-0 font-semibold`}>
                    {fmtTokens(model.totalPsyche.tokens, lang)}
                  </td>
                  <td className={`${tdNum} border-b-0 font-semibold`}>
                    <Money v={model.totalBaseline.cost} exact />
                  </td>
                  <td className={`${tdNum} border-b-0 font-semibold`}>
                    {fmtTokens(model.totalBaseline.tokens, lang)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="font-display text-[18px] font-semibold uppercase tracking-[0.05em]">
              {t("usage.per_agent")}
            </h3>
            <table className="mt-2 w-full border-collapse">
              <thead>
                <tr>
                  <th className={th}>{t("usage.agent")}</th>
                  <th className={thNum} colSpan={2}>
                    {t("ver.psyche")}
                  </th>
                  <th className={thNum} colSpan={2}>
                    {t("ver.baseline")}
                  </th>
                </tr>
                <tr>
                  <th className={th} />
                  <th className={thNum}>{t("usage.cost")}</th>
                  <th className={thNum}>{t("usage.tokens")}</th>
                  <th className={thNum}>{t("usage.cost")}</th>
                  <th className={thNum}>{t("usage.tokens")}</th>
                </tr>
              </thead>
              <tbody>
                {model.agents.map((a) => {
                  const p = model.agentsPsyche.get(a) ?? ZERO;
                  const b = model.agentsBaseline.get(a) ?? ZERO;
                  return (
                    <tr key={a}>
                      <td className={`${td} font-mono font-semibold`}>{a}</td>
                      <td className={tdNum}>
                        <Money v={p.cost} exact />
                      </td>
                      <td className={tdNum}>{fmtTokens(p.tokens, lang)}</td>
                      <td className={tdNum}>
                        <Money v={b.cost} exact />
                      </td>
                      <td className={tdNum}>{fmtTokens(b.tokens, lang)}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td className={`${td} border-b-0 font-sans font-semibold`}>{t("usage.total")}</td>
                  <td className={`${tdNum} border-b-0 font-semibold`}>
                    <Money v={model.totalPsyche.cost} exact />
                  </td>
                  <td className={`${tdNum} border-b-0 font-semibold`}>
                    {fmtTokens(model.totalPsyche.tokens, lang)}
                  </td>
                  <td className={`${tdNum} border-b-0 font-semibold`}>
                    <Money v={model.totalBaseline.cost} exact />
                  </td>
                  <td className={`${tdNum} border-b-0 font-semibold`}>
                    {fmtTokens(model.totalBaseline.tokens, lang)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <h3 className="mt-8 font-display text-[18px] font-semibold uppercase tracking-[0.05em]">
          {t("usage.chart")}
        </h3>
        <div className="mb-3 mt-1 flex items-center gap-4 text-[12px] text-ink-soft">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 bg-ink" />
            {t("ver.psyche")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 bg-ink-soft" />
            {t("ver.baseline")}
          </span>
        </div>
        <div
          role="img"
          aria-label={`${t("usage.chart")}: ${chartData.map((d) => `${d.doc} $${d.psyche.toFixed(2)} / $${d.baseline.toFixed(2)}`).join("; ")}`}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }} barGap={3}>
              <XAxis
                dataKey="doc"
                tick={{ fill: "var(--color-ink-soft)", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-ink)" }}
                interval={0}
              />
              <YAxis
                tick={{ fill: "var(--color-ink-soft)", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: "var(--color-ink)" }}
                width={52}
                tickFormatter={(v: number) => `$${v.toFixed(2)}`}
              />
              <Tooltip content={<ChartTip />} cursor={{ fill: "var(--color-concrete-deep)" }} />
              <Bar dataKey="psyche" name={t("ver.psyche")} fill="var(--color-ink)" />
              <Bar dataKey="baseline" name={t("ver.baseline")} fill="var(--color-ink-soft)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

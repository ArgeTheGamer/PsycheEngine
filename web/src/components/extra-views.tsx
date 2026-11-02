"use client";

import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ChangeDiff } from "@/components/change-diff";
import { LocLabel } from "@/components/shell";
import { loadMutations } from "@/lib/data";
import { useT, type StringKey } from "@/lib/i18n";
import type { MutationsFile } from "@/lib/types";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return (await res.json()) as T;
}

function useJSON<T>(path: string): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    getJSON<T>(path).then((d) => alive && setData(d)).catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [path]);
  return data;
}

function Heading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-[26px] font-bold uppercase leading-none tracking-[0.02em]">{title}</h2>
      {sub && <p className="mt-2 max-w-[760px] text-[14px] leading-snug text-ink-soft">{sub}</p>}
    </div>
  );
}

function Count({ value, label, problem = false }: { value: number | string; label: string; problem?: boolean }) {
  return (
    <div className="border-r border-rule px-4 py-3 last:border-r-0">
      <div className={`stencil text-[44px] leading-none ${problem ? "text-hazard" : "text-ink"}`}>{value}</div>
      <div className="mt-1 text-[12px] text-ink-soft">{label}</div>
    </div>
  );
}

// --- closed model vs open weights -------------------------------------------------------------

const COMPARED: { id: string; key: StringKey }[] = [
  { id: "md-v4y", key: "open.closed" },
  { id: "open-v1y", key: "open.open" },
];

export function OpenCompare() {
  const { t } = useT();
  const [files, setFiles] = useState<Record<string, MutationsFile | null>>({});
  useEffect(() => {
    let alive = true;
    Promise.all(COMPARED.map((c) => loadMutations(c.id).catch(() => null))).then(
      (all) => alive && setFiles(Object.fromEntries(COMPARED.map((c, i) => [c.id, all[i]]))),
    );
    return () => {
      alive = false;
    };
  }, []);
  if (!COMPARED.every((c) => files[c.id])) return null;

  return (
    <section className="border-b-[1.5px] border-ink bg-label px-6 py-6">
      <Heading title={t("open.title")} sub={t("open.sub")} />
      <div className="grid gap-6 md:grid-cols-2">
        {COMPARED.map((c) => {
          const steps = files[c.id]!.steps;
          const rows = steps.map((s, i) => ({
            step: i + 1,
            psyche: s.engine.stale.length,
            baseline: s.baseline.stale.length,
            perDoc: s.baseline_per_doc?.stale.length ?? 0,
          }));
          const last = rows[rows.length - 1];
          return (
            <div key={c.id} className="border-[1.5px] border-ink bg-label">
              <div className="border-b border-rule px-4 py-2 font-display text-[18px] font-semibold uppercase tracking-[0.03em]">
                {t(c.key)}
              </div>
              <div className="px-2 pt-3">
                <ResponsiveContainer width="100%" height={170}>
                  <LineChart data={rows} margin={{ left: 0, right: 8, top: 4 }}>
                    <XAxis dataKey="step" tick={{ fill: "var(--color-ink-soft)", fontSize: 11 }} tickLine={false}
                      axisLine={{ stroke: "var(--color-ink)" }} interval={0} />
                    <YAxis tick={{ fill: "var(--color-ink-soft)", fontSize: 11 }} tickLine={false}
                      axisLine={{ stroke: "var(--color-ink)" }} allowDecimals={false} width={34} />
                    <Line type="monotone" dataKey="baseline" stroke="var(--color-hazard)" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="perDoc" stroke="var(--color-hazard)" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="psyche" stroke="var(--color-ink)" strokeWidth={3} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 border-t border-rule">
                <Count value={last.psyche} label={t("ver.psyche")} />
                <Count value={last.baseline} label={t("ver.baseline_ctx")} problem={last.baseline > 0} />
                <Count value={last.perDoc} label={t("ver.baseline_perdoc")} problem={last.perDoc > 0} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] text-ink-soft">{t("open.note")}</p>
    </section>
  );
}

// --- critic check -------------------------------------------------------------------------------

type CriticCase = {
  kind: "value" | "zone" | "procedure" | "clean";
  section: string;
  note: string;
  planted: string;
  results: Record<string, { accepted: boolean; caught: boolean; quotes: string[] }>;
};
type CriticBench = { summary: Record<string, Record<string, string>>; cases: CriticCase[] };

const KINDS = ["value", "zone", "procedure"] as const;

export function CriticCheck() {
  const { t } = useT();
  const bench = useJSON<CriticBench>("/extra/critic_bench.json");
  const [open, setOpen] = useState(false);
  if (!bench) return null;
  const models = Object.keys(bench.summary);
  const ratio = (s: string) => s.split("/").map(Number) as [number, number];

  return (
    <section className="border-t-[1.5px] border-ink bg-label px-6 py-6">
      <Heading title={t("critic.title")} sub={t("critic.sub")} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-[1.5px] border-ink text-[14px]">
          <thead>
            <tr className="border-b-[1.5px] border-ink bg-concrete-deep text-left">
              <th className="px-3 py-2 font-display text-[15px] uppercase tracking-[0.04em]">{t("critic.model")}</th>
              {KINDS.map((k) => (
                <th key={k} className="px-3 py-2 font-display text-[15px] uppercase tracking-[0.04em]">{t(`critic.${k}` as StringKey)}</th>
              ))}
              <th className="px-3 py-2 font-display text-[15px] uppercase tracking-[0.04em]">{t("critic.false")}</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m} className="border-b border-rule last:border-b-0">
                <td className="px-3 py-2 font-semibold">{m}</td>
                {KINDS.map((k) => {
                  const [got, all] = ratio(bench.summary[m][k]);
                  return (
                    <td key={k} className={`px-3 py-2 font-mono ${got < all ? "text-hazard" : ""}`}>{bench.summary[m][k]}</td>
                  );
                })}
                <td className={`px-3 py-2 font-mono ${ratio(bench.summary[m].false_alarms)[0] > 0 ? "text-hazard" : ""}`}>
                  {bench.summary[m].false_alarms}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="mt-4 border-[1.5px] border-ink bg-label px-3 py-1.5 font-display text-[15px] font-semibold uppercase tracking-[0.04em]">
        {open ? t("critic.hide") : t("critic.show")} ({bench.cases.length})
      </button>
      {open && (
        <ul className="mt-4 flex flex-col gap-3">
          {bench.cases.map((c, i) => (
            <li key={i} className="border border-rule bg-concrete p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <LocLabel id={c.section} size={13} />
                <span className="font-mono text-[12px] uppercase text-ink-soft">{t(`critic.${c.kind}` as StringKey)}</span>
                <span className="font-mono text-[13px]">{c.note}</span>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {models.map((m) => {
                  const r = c.results[m];
                  const bad = c.kind === "clean" ? !r.accepted : !r.caught;
                  const verdict = c.kind === "clean"
                    ? (r.accepted ? t("critic.accepted") : t("critic.false_alarm"))
                    : (r.caught ? t("critic.caught") : t("critic.missed"));
                  return (
                    <div key={m} className={`border-l-[3px] bg-label px-3 py-2 text-[13px] ${bad ? "border-hazard" : "border-ink"}`}>
                      <div className="font-semibold">{m} · <span className={bad ? "text-hazard" : ""}>{verdict}</span></div>
                      {r.quotes.slice(0, 1).map((q, j) => (
                        <p key={j} className="mt-1 text-ink-soft">“{q}”</p>
                      ))}
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// --- adopt and plain-word change -----------------------------------------------------------------

type Question = { category: string; section_a: string; quote_a: string; section_b: string; quote_b: string; explanation: string };
type Decision = { question: string; answer: string; facts?: string[]; rewritten: string[] };
type Adopt = { facts: number; conflicts_before: number; dismissed: number; conflicts_after: number; sections_rewritten: number; decisions: Decision[] };
type SectionText = { id: string; title: string; text: string };
type Diff = { section_id: string; title: string; before: string; after: string };
type Request = { message: string; changes: { fact_id: string; new_value: string; new_statement: string; reason: string }[]; unclear: string[] };
type Moved = { fact_id: string; old_value: string; new_value: string };
type Change = Moved & { also: Moved[]; derived: Moved[]; affected_sections: string[] };
type Notice = { audience: string; subject: string; body: string };

function Option({ letter, section, quote, chosen }: { letter: string; section: string; quote: string; chosen: boolean }) {
  return (
    <div className={`border-[1.5px] p-3 ${chosen ? "border-ink bg-label" : "border-rule bg-concrete"}`}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className={`px-1.5 font-mono text-[13px] uppercase ${chosen ? "bg-ink text-label" : "border border-rule"}`}>{letter}</span>
        <LocLabel id={section} size={13} />
      </div>
      <p className="text-[14px] leading-snug">“{quote}”</p>
    </div>
  );
}

export function AdoptView() {
  const { t } = useT();
  const questions = useJSON<Record<string, Question>>("/extra/adopt/questions.json");
  const answers = useJSON<Record<string, string>>("/extra/adopt/answers.json");
  const adopt = useJSON<Adopt>("/extra/adopt/adopt.json");
  const before = useJSON<SectionText[]>("/extra/adopt/sections_before.json");
  const after = useJSON<SectionText[]>("/extra/adopt/sections.json");
  const request = useJSON<Request>("/extra/request/request.json");
  const change = useJSON<Change>("/extra/request/change.json");
  const diff = useJSON<Diff[]>("/extra/request/diff.json");
  const notices = useJSON<Notice[]>("/extra/request/notices.json");
  const [shown, setShown] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const diffsFor = useMemo(() => {
    if (!before || !after) return () => [] as Diff[];
    const b = new Map(before.map((s) => [s.id, s]));
    return (ids: string[]) =>
      after.filter((s) => ids.includes(s.id) && b.get(s.id)).map((s) => ({
        section_id: s.id, title: s.title, before: b.get(s.id)!.text, after: s.text,
      }));
  }, [before, after]);

  if (!questions || !answers || !adopt) return <p className="m-6 text-[14px] text-ink-soft">{t("state.loading")}</p>;

  return (
    <div>
      <section className="px-6 py-6">
        <Heading title={t("adopt.title")} sub={t("adopt.sub")} />
        <div className="mb-6 grid grid-cols-2 border-[1.5px] border-ink bg-label sm:grid-cols-5">
          <Count value={adopt.facts} label={t("adopt.facts")} />
          <Count value={adopt.conflicts_before} label={t("adopt.before")} problem />
          <Count value={adopt.dismissed} label={t("adopt.dismissed")} />
          <Count value={adopt.sections_rewritten} label={t("adopt.rewritten")} />
          <Count value={adopt.conflicts_after} label={t("adopt.after")} problem={adopt.conflicts_after > 0} />
        </div>
        <ol className="flex flex-col gap-4">
          {Object.entries(questions).map(([n, q]) => {
            const answer = (answers[n] ?? "").trim();
            const d = adopt.decisions.find((x) => x.question === n);
            const dismissed = answer.toLowerCase() === "ok";
            return (
              <li key={n} className="border-[1.5px] border-ink bg-label">
                <div className="flex flex-wrap items-baseline gap-3 border-b border-rule px-4 py-2">
                  <span className="font-display text-[20px] font-bold">{n}</span>
                  <span className="font-mono text-[12px] uppercase text-ink-soft">{t(`cat.${q.category}` as StringKey)}</span>
                  <span className="text-[13px] text-ink-soft">{q.explanation}</span>
                </div>
                <div className="grid gap-3 p-4 md:grid-cols-2">
                  <Option letter="a" section={q.section_a} quote={q.quote_a} chosen={answer.toLowerCase() === "a"} />
                  <Option letter="b" section={q.section_b} quote={q.quote_b} chosen={answer.toLowerCase() === "b"} />
                </div>
                <div className="flex flex-wrap items-center gap-3 border-t border-rule px-4 py-2 text-[13px]">
                  <span className="font-display text-[15px] font-semibold uppercase tracking-[0.04em]">{t("adopt.manager")}</span>
                  <span>{dismissed ? t("adopt.not_conflict") : answer.length > 1 ? answer : t("adopt.version").replace("{v}", answer)}</span>
                  {d && !dismissed && (
                    <span className="text-ink-soft">
                      · {d.facts && d.facts.length > 0 ? `${t("adopt.canon")} ${d.facts.join(", ")}` : t("adopt.canon_agreed")}
                      {" · "}{d.rewritten.length} {t("adopt.sections")}
                    </span>
                  )}
                  {d && d.rewritten.length > 0 && (
                    <button type="button" onClick={() => setShown(shown === n ? null : n)} aria-expanded={shown === n}
                      className="ml-auto border-[1.5px] border-ink px-2 py-1 font-display text-[14px] font-semibold uppercase tracking-[0.04em]">
                      {shown === n ? t("adopt.hide") : t("adopt.show")}
                    </button>
                  )}
                </div>
                {shown === n && d && (
                  <div className="border-t border-rule p-4">
                    <ChangeDiff diffs={diffsFor(d.rewritten)} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {request && change && (
        <section className="border-t-[1.5px] border-ink bg-label px-6 py-6">
          <Heading title={t("request.title")} sub={t("request.sub")} />
          <blockquote className="mb-5 border-l-[3px] border-ink bg-concrete px-4 py-3 text-[16px] leading-snug">“{request.message}”</blockquote>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 font-display text-[18px] font-semibold uppercase tracking-[0.03em]">{t("request.reading")}</h3>
              <ul className="flex flex-col gap-2">
                {request.changes.map((c) => {
                  const moved = [change, ...change.also].find((m) => m.fact_id === c.fact_id);
                  return (
                    <li key={c.fact_id} className="border border-rule bg-concrete px-3 py-2 text-[14px]">
                      <span className="font-mono">{c.fact_id}</span>{" "}
                      {moved && <span className="font-mono">{moved.old_value} → <b>{moved.new_value}</b></span>}
                      <p className="mt-1 text-[13px] text-ink-soft">{c.reason}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-display text-[18px] font-semibold uppercase tracking-[0.03em]">{t("year.knockon")}</h3>
              <ul className="flex flex-col gap-2">
                {change.derived.map((m) => (
                  <li key={m.fact_id} className="border border-rule bg-concrete px-3 py-2 font-mono text-[14px]">
                    {m.fact_id} {m.old_value} → <b>{m.new_value}</b>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[14px]">
                <span className="stencil text-[32px]">{change.affected_sections.length}</span> {t("adopt.sections")}
              </p>
            </div>
          </div>
          {notices && (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {notices.map((n) => (
                <article key={n.audience} className="border-[1.5px] border-ink bg-label p-4">
                  <div className="font-mono text-[12px] uppercase text-ink-soft">{n.audience}</div>
                  <h4 className="mt-1 font-semibold">{n.subject}</h4>
                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed">{n.body}</p>
                </article>
              ))}
            </div>
          )}
          {diff && (
            <>
              <button type="button" onClick={() => setShowDiff(!showDiff)} aria-expanded={showDiff}
                className="mt-5 border-[1.5px] border-ink px-3 py-1.5 font-display text-[15px] font-semibold uppercase tracking-[0.04em]">
                {showDiff ? t("adopt.hide") : t("adopt.show")} ({diff.length})
              </button>
              {showDiff && <div className="mt-4"><ChangeDiff diffs={diff} /></div>}
            </>
          )}
        </section>
      )}
    </div>
  );
}

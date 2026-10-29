"use client";

import type { ReactNode } from "react";
import { Activity, BarChart3, CalendarRange, FileText, Network, Play, Wallet } from "lucide-react";
import { useT, type StringKey } from "@/lib/i18n";
import type { RunInfo } from "@/lib/types";

export type Tab = "production" | "benchmark" | "year" | "graph" | "logs" | "usage";

const TABS: { id: Tab; icon: typeof FileText }[] = [
  { id: "production", icon: FileText },
  { id: "benchmark", icon: BarChart3 },
  { id: "year", icon: CalendarRange },
  { id: "graph", icon: Network },
  { id: "logs", icon: Activity },
  { id: "usage", icon: Wallet },
];

export function Shell({
  tab,
  onTab,
  runs,
  runId,
  onRun,
  onPlay,
  canPlay,
  onYear,
  canYear,
  children,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  runs: RunInfo[];
  runId: string;
  onRun: (id: string) => void;
  onPlay: () => void;
  canPlay: boolean;
  onYear: () => void;
  canYear: boolean;
  children: ReactNode;
}) {
  const { t, lang, setLang } = useT();
  return (
    <div className="grid min-h-screen grid-cols-[232px_1fr] max-md:grid-cols-1">
      <aside className="flex flex-col border-r-[1.5px] border-ink bg-concrete-deep max-md:border-r-0 max-md:border-b-[1.5px]">
        <div className="border-b-[1.5px] border-ink px-5 pb-4 pt-5">
          <div className="font-display text-[34px] font-bold uppercase leading-none tracking-[0.01em]">PsycheEngine</div>
          <p className="mt-2 text-[13px] leading-snug text-ink-soft">{t("app.tagline")}</p>
        </div>
        <nav aria-label="Sections" className="flex flex-col py-2 max-md:flex-row max-md:overflow-x-auto">
          {TABS.map(({ id, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTab(id)}
                aria-current={active ? "page" : undefined}
                className={`group flex items-start gap-3 px-5 py-3 text-left transition-colors max-md:shrink-0 ${
                  active ? "bg-ink text-label" : "text-ink hover:bg-concrete"
                }`}
              >
                <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="flex flex-col">
                  <span className="font-display text-[20px] font-semibold uppercase leading-none tracking-[0.03em]">
                    {t(`nav.${id}` as StringKey)}
                  </span>
                  <span className={`mt-1 text-[12px] leading-tight max-md:hidden ${active ? "text-concrete-deep" : "text-ink-soft"}`}>
                    {t(`nav.${id}.hint` as StringKey)}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>
        <div className="mt-auto border-t-[1.5px] border-ink px-5 py-4 text-[12px] text-ink-soft max-md:hidden">
          Muse Spark 1.3 · Muse Spark Open
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b-[1.5px] border-ink bg-label px-5 py-3">
          <label className="flex items-center gap-2 text-[13px] text-ink-soft">
            <span className="font-display text-[15px] font-semibold uppercase tracking-[0.04em] text-ink">{t("top.run")}</span>
            <select
              value={runId}
              onChange={(e) => onRun(e.target.value)}
              className="max-w-[440px] border-[1.5px] border-ink bg-label px-2 py-1.5 font-sans text-[14px] text-ink"
            >
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onYear}
              disabled={!canYear}
              className="border-[1.5px] border-ink bg-label px-3 py-1.5 font-display text-[16px] font-semibold uppercase tracking-[0.04em] disabled:opacity-40"
            >
              {t("top.year")}
            </button>
            <button
              type="button"
              onClick={onPlay}
              disabled={!canPlay}
              className="flex items-center gap-2 border-[1.5px] border-ink bg-ink px-3 py-1.5 font-display text-[16px] font-semibold uppercase tracking-[0.04em] text-label disabled:opacity-40"
            >
              <Play className="h-4 w-4" fill="currentColor" aria-hidden />
              {t("top.play")}
            </button>
            <div role="group" aria-label={t("top.lang")} className="ml-2 flex border-[1.5px] border-ink">
              {(["en", "pl"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={`px-2.5 py-1.5 font-mono text-[13px] uppercase ${lang === l ? "bg-ink text-label" : "bg-label text-ink"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

/** Rack-location style id: "OPS · CH04 · S2" with the document as the dark block. */
export function LocLabel({ id, size = 15 }: { id: string; size?: number }) {
  const [doc, ...rest] = id.split(".");
  return (
    <span className="loc-label" style={{ fontSize: size }}>
      <b>{doc}</b>
      {rest.length > 0 && <span>{rest.join(" · ")}</span>}
    </span>
  );
}

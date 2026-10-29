"use client";

import { useEffect, useState } from "react";
import { Shell, type Tab } from "@/components/shell";
import { ProductionView } from "@/components/production-view";
import { BenchmarkView } from "@/components/benchmark-view";
import { CanonPanel } from "@/components/canon-panel";
import { ChartsPanel } from "@/components/charts-panel";
import { AgentsPanel } from "@/components/agents-panel";
import { MaintenanceTab } from "@/components/maintenance-tab";
import { ChangeReplay } from "@/components/change-replay";
import { PlaybackView } from "@/components/playback-view";
import { YearView } from "@/components/year-view";
import { loadRun, loadRuns, type RunData } from "@/lib/data";
import { useT } from "@/lib/i18n";
import type { FactChangeRecord, RunInfo } from "@/lib/types";

export default function Home() {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>("production");
  const [runs, setRuns] = useState<RunInfo[]>([]);
  const [runId, setRunId] = useState("md-v4y");
  const [data, setData] = useState<RunData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replay, setReplay] = useState<FactChangeRecord | null>(null);
  const [playing, setPlaying] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);

  useEffect(() => {
    loadRuns()
      .then((r) => {
        setRuns(r.runs);
        if (r.runs.length > 0 && !r.runs.some((x) => x.id === runId)) setRunId(r.runs[0].id);
      })
      .catch((e: unknown) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    loadRun(runId)
      .then((d) => alive && setData(d))
      .catch((e: unknown) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [runId]);

  const label = runs.find((r) => r.id === runId)?.label ?? runId;
  const latestFacts = data?.canon[data.canon.length - 1]?.facts ?? [];
  const betweenDocs = data?.audit ? Object.values(data.audit.between).reduce((a, b) => a + b, 0) : 0;

  return (
    <Shell
      tab={tab}
      onTab={setTab}
      runs={runs}
      runId={runId}
      onRun={(id) => {
        setReplay(null);
        setRunId(id);
      }}
      onPlay={() => setPlaying(true)}
      canPlay={(data?.events.length ?? 0) > 0}
      onYear={() => setYearOpen(true)}
      canYear={(data?.mutations?.steps.length ?? 0) > 0}
    >
      {error && (
        <p className="m-6 border-[1.5px] border-hazard bg-label px-4 py-3 text-[14px]">
          {t("state.error")} {error}
        </p>
      )}
      {!error && !data && <p className="m-6 text-[14px] text-ink-soft">{t("state.loading")}</p>}
      {data && tab === "production" && (
        <ProductionView
          key={runId}
          documents={data.documents}
          sectionsPsyche={data.sectionsPsyche}
          sectionsBaseline={data.sectionsBaseline}
          contradictionsPsyche={data.contradictionsPsyche}
          contradictionsBaseline={data.contradictionsBaseline}
        />
      )}
      {data && tab === "benchmark" && (
        <BenchmarkView
          key={runId}
          documents={data.documents}
          sectionsPsyche={data.sectionsPsyche}
          sectionsBaseline={data.sectionsBaseline}
          contradictionsPsyche={data.contradictionsPsyche}
          contradictionsBaseline={data.contradictionsBaseline}
          auditPsyche={data.audit}
          auditBaseline={data.auditBaseline}
        />
      )}
      {/* The tabs below reuse the previous panels until they are restyled to the new system. */}
      {data && tab !== "production" && tab !== "benchmark" && (
        <div className="dark grid gap-4 bg-zinc-950 p-4 text-zinc-200">
          {tab === "usage" && (
            <ChartsPanel
              documents={data.documents}
              sectionsPsyche={data.sectionsPsyche}
              sectionsBaseline={data.sectionsBaseline}
              contradictionsPsyche={data.contradictionsPsyche}
              contradictionsBaseline={data.contradictionsBaseline}
              callsPsyche={data.callsPsyche}
              callsBaseline={data.callsBaseline}
              mutations={data.mutations}
              canon={data.canon}
              onOpenSection={() => setTab("production")}
            />
          )}
          {tab === "year" && data.mutations && (
            <MaintenanceTab
              mutations={data.mutations}
              canon={data.canon}
              sectionsPsyche={data.sectionsPsyche}
              sectionsBaseline={data.sectionsBaseline}
              documents={data.documents}
            />
          )}
          {tab === "graph" && (
            <CanonPanel
              canon={data.canon}
              documents={data.documents}
              sections={data.sectionsPsyche}
              changes={data.changes}
              onReplay={setReplay}
            />
          )}
          {tab === "logs" && <AgentsPanel events={data.events} />}
        </div>
      )}
      {data && playing && (
        <PlaybackView
          runLabel={label}
          events={data.events}
          sections={data.sectionsPsyche}
          canon={data.canon}
          documents={data.documents}
          calls={data.callsPsyche}
          betweenDocs={betweenDocs}
          onExit={() => setPlaying(false)}
        />
      )}
      {data && yearOpen && data.mutations && (
        <YearView runLabel={label} mutations={data.mutations} sectionsBaseline={data.sectionsBaseline} onExit={() => setYearOpen(false)} />
      )}
      {data && replay && (
        <ChangeReplay
          key={replay.change.fact_id}
          record={replay}
          fact={latestFacts.find((f) => f.id === replay.change.fact_id)}
          sections={data.sectionsPsyche}
          documents={data.documents}
          onClose={() => setReplay(null)}
          onOpenSection={() => {
            setReplay(null);
            setTab("production");
          }}
        />
      )}
    </Shell>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/header";
import { CanonPanel } from "@/components/canon-panel";
import { DocPanel } from "@/components/doc-panel";
import { ChartsPanel } from "@/components/charts-panel";
import { AgentsPanel } from "@/components/agents-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { loadRun, loadRuns, type RunData } from "@/lib/data";
import type { RunInfo } from "@/lib/types";

export default function Home() {
  const [runs, setRuns] = useState<RunInfo[]>([]);
  const [runId, setRunId] = useState("demo");
  const [data, setData] = useState<RunData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRuns()
      .then((r) => {
        setRuns(r.runs);
        if (r.runs.length > 0 && !r.runs.some((x) => x.id === runId)) {
          setRunId(r.runs[0].id);
        }
      })
      .catch((e: unknown) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = useCallback((id: string) => {
    setData(null);
    setError(null);
    loadRun(id)
      .then(setData)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  useEffect(() => {
    reload(runId);
  }, [runId, reload]);

  return (
    <div className="min-h-screen">
      <Header runs={runs} runId={runId} onRunChange={setRunId} />
      <main className="grid gap-4 p-4 lg:grid-cols-2">
        {error && (
          <Card className="lg:col-span-2">
            <CardContent>
              <p className="text-sm text-rose-300">
                Failed to load run data: {error}
              </p>
            </CardContent>
          </Card>
        )}
        {!error && !data && (
          <Card className="lg:col-span-2">
            <CardContent>
              <p className="text-sm text-zinc-400">Loading run data…</p>
            </CardContent>
          </Card>
        )}
        {data && (
          <>
            <CanonPanel canon={data.canon} sections={data.sectionsPsyche} />
            <DocPanel
              sectionsPsyche={data.sectionsPsyche}
              sectionsBaseline={data.sectionsBaseline}
              contradictionsPsyche={data.contradictionsPsyche}
              contradictionsBaseline={data.contradictionsBaseline}
              canonFacts={data.canon[data.canon.length - 1].facts}
            />
            <ChartsPanel
              sections={data.sectionsPsyche}
              contradictionsPsyche={data.contradictionsPsyche}
              contradictionsBaseline={data.contradictionsBaseline}
              callsPsyche={data.callsPsyche}
              callsBaseline={data.callsBaseline}
            />
            <AgentsPanel events={data.events} />
          </>
        )}
      </main>
    </div>
  );
}

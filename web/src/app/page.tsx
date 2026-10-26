"use client";

import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/header";
import { CanonPanel } from "@/components/canon-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { loadRun, loadRuns, type RunData } from "@/lib/data";
import type { RunInfo } from "@/lib/types";

function Placeholder({ title }: { title: string }) {
  return (
    <Card className="min-h-[440px] xl:h-[calc((100vh-112px)/2)] xl:min-h-[400px]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-zinc-500">Coming in the next commit.</p>
      </CardContent>
    </Card>
  );
}

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
            <Placeholder title="Document" />
            <Placeholder title="Charts" />
            <Placeholder title="Agent log" />
          </>
        )}
      </main>
    </div>
  );
}

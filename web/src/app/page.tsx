"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { CanonPanel } from "@/components/canon-panel";
import { DocPanel } from "@/components/doc-panel";
import { ChartsPanel } from "@/components/charts-panel";
import { AgentsPanel } from "@/components/agents-panel";
import { ChangeReplay } from "@/components/change-replay";
import { Card, CardContent } from "@/components/ui";
import { loadRun, loadRuns, type RunData } from "@/lib/data";
import type { FactChangeRecord, RunInfo } from "@/lib/types";

export default function Home() {
  const [runs, setRuns] = useState<RunInfo[]>([]);
  const [runId, setRunId] = useState("demo");
  const [data, setData] = useState<RunData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replay, setReplay] = useState<FactChangeRecord | null>(null);

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

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    loadRun(runId)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(String(e));
      });
    return () => {
      alive = false;
    };
  }, [runId]);

  const sectionIds = new Set(
    (data?.sectionsPsyche ?? []).map((s) => s.id),
  );
  const rewrittenIds = new Set(
    (data?.changes ?? []).flatMap((c) =>
      c.change.affected_sections.filter((id) => sectionIds.has(id)),
    ),
  );
  const hasChanges = (data?.changes.length ?? 0) > 0;

  return (
    <div className="min-h-screen">
      <Header
        runs={runs}
        runId={runId}
        onRunChange={(id) => {
          setReplay(null);
          setRunId(id);
        }}
        rewritten={hasChanges ? rewrittenIds.size : undefined}
        untouched={
          hasChanges ? sectionIds.size - rewrittenIds.size : undefined
        }
      />
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
            <CanonPanel
              canon={data.canon}
              sections={data.sectionsPsyche}
              changes={data.changes}
              onReplay={setReplay}
            />
            <DocPanel
              sectionsPsyche={data.sectionsPsyche}
              sectionsBaseline={data.sectionsBaseline}
              contradictionsPsyche={data.contradictionsPsyche}
              contradictionsBaseline={data.contradictionsBaseline}
              canonFacts={data.canon[data.canon.length - 1]?.facts ?? []}
            />
            <ChartsPanel
              sectionsPsyche={data.sectionsPsyche}
              sectionsBaseline={data.sectionsBaseline}
              contradictionsPsyche={data.contradictionsPsyche}
              contradictionsBaseline={data.contradictionsBaseline}
              callsPsyche={data.callsPsyche}
              callsBaseline={data.callsBaseline}
            />
            <AgentsPanel events={data.events} />
          </>
        )}
      </main>
      {data && replay && (
        <ChangeReplay
          record={replay}
          fact={(data.canon[data.canon.length - 1]?.facts ?? []).find(
            (f) => f.id === replay.change.fact_id,
          )}
          sections={data.sectionsPsyche}
          onClose={() => setReplay(null)}
        />
      )}
    </div>
  );
}

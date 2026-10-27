"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/header";
import { CanonPanel } from "@/components/canon-panel";
import { DocPanel, type DocFocus } from "@/components/doc-panel";
import { ChartsPanel } from "@/components/charts-panel";
import { AgentsPanel } from "@/components/agents-panel";
import { ChangeReplay } from "@/components/change-replay";
import { PlaybackView } from "@/components/playback-view";
import { Card, CardContent } from "@/components/ui";
import { loadRun, loadRuns, type RunData } from "@/lib/data";
import type { FactChangeRecord, RunInfo } from "@/lib/types";

export default function Home() {
  const [runs, setRuns] = useState<RunInfo[]>([]);
  const [runId, setRunId] = useState("md-v2m");
  const [data, setData] = useState<RunData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replay, setReplay] = useState<FactChangeRecord | null>(null);
  const [docFocus, setDocFocus] = useState<DocFocus | null>(null);
  const [playing, setPlaying] = useState(false);

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
  const psyDocOf = new Map(
    (data?.sectionsPsyche ?? []).map((s) => [s.id, s.doc ?? "ops"]),
  );
  const betweenDocs = data?.audit
    ? Object.values(data.audit.between).reduce((a, b) => a + b, 0)
    : ((data?.contradictionsPsyche ?? []).filter((c) => {
        const a = psyDocOf.get(c.section_a);
        const b = psyDocOf.get(c.section_b);
        return a !== undefined && b !== undefined && a !== b;
      }).length);

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
        docCount={data?.documents.length}
        onPlay={() => setPlaying(true)}
        canPlay={(data?.events.length ?? 0) > 0}
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
              documents={data.documents}
              sections={data.sectionsPsyche}
              changes={data.changes}
              onReplay={setReplay}
            />
            <DocPanel
              documents={data.documents}
              sectionsPsyche={data.sectionsPsyche}
              sectionsBaseline={data.sectionsBaseline}
              contradictionsPsyche={data.contradictionsPsyche}
              contradictionsBaseline={data.contradictionsBaseline}
              canonFacts={data.canon[data.canon.length - 1]?.facts ?? []}
              focus={docFocus}
            />
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
              onOpenSection={(run, doc, sectionId) =>
                setDocFocus({ run, doc, sectionId })
              }
            />
            <AgentsPanel events={data.events} />
          </>
        )}
      </main>
      {data && playing && (
        <PlaybackView
          runLabel={runs.find((r) => r.id === runId)?.label ?? runId}
          events={data.events}
          sections={data.sectionsPsyche}
          canon={data.canon}
          documents={data.documents}
          calls={data.callsPsyche}
          betweenDocs={betweenDocs}
          onExit={() => setPlaying(false)}
        />
      )}
      {data && replay && (
        <ChangeReplay
          key={replay.change.fact_id}
          record={replay}
          fact={(data.canon[data.canon.length - 1]?.facts ?? []).find(
            (f) => f.id === replay.change.fact_id,
          )}
          sections={data.sectionsPsyche}
          documents={data.documents}
          onClose={() => setReplay(null)}
          onOpenSection={(run, doc, sectionId) => {
            setReplay(null);
            setDocFocus({ run, doc, sectionId });
          }}
        />
      )}
    </div>
  );
}

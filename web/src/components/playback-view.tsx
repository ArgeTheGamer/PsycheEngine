"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, X } from "lucide-react";
import type {
  AgentEvent,
  CallRecord,
  CanonVersion,
  DocumentInfo,
  Section,
} from "@/lib/types";
import { Badge, Button } from "./ui";
import { cn } from "@/lib/utils";

const SPEEDS = [10, 30, 60, 120] as const;
const DEFAULT_SPEED_IDX = 2;

type Status = "idle" | "writing" | "rejected" | "accepted";

function sidOf(e: AgentEvent): string | null {
  return typeof e.section_id === "string" ? e.section_id : null;
}

function fmtDur(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}

export function PlaybackView({
  runLabel,
  events,
  sections,
  canon,
  documents,
  calls,
  betweenDocs,
  onExit,
}: {
  runLabel: string;
  events: AgentEvent[];
  sections: Section[];
  canon: CanonVersion[];
  documents: DocumentInfo[];
  calls: CallRecord[];
  betweenDocs: number;
  onExit: () => void;
}) {
  const sorted = useMemo(
    () => [...events].sort((a, b) => a.ts - b.ts),
    [events],
  );
  const t0 = sorted.length > 0 ? sorted[0].ts : 0;
  const duration = Math.max(
    0,
    (sorted.length > 0 ? sorted[sorted.length - 1].ts : 0) - t0,
  );
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speedIdx, setSpeedIdx] = useState(DEFAULT_SPEED_IDX);
  const [finished, setFinished] = useState(sorted.length === 0);
  const headRef = useRef(0);
  const speed = SPEEDS[speedIdx];

  useEffect(() => {
    if (!playing || finished || duration <= 0) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      headRef.current = Math.min(duration, headRef.current + dt * speed);
      setPlayhead(headRef.current);
      if (headRef.current >= duration) {
        setFinished(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, finished, speed, duration]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        if (!finished) setPlaying((p) => !p);
      } else if (e.key === "ArrowLeft") {
        setSpeedIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        setSpeedIdx((i) => Math.min(SPEEDS.length - 1, i + 1));
      } else if (e.key === "Escape") {
        onExit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, onExit]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const applied = useMemo(
    () => sorted.filter((e) => e.ts - t0 <= playhead),
    [sorted, t0, playhead],
  );

  const model = useMemo(() => {
    const status = new Map<string, Status>();
    let current: string | null = null;
    let lastAccept: { sid: string; at: number } | null = null;
    let lastVerdict: AgentEvent | null = null;
    let rejections = 0;
    let canonUpdates = 0;
    for (const e of applied) {
      const sid = sidOf(e);
      if (e.kind === "draft" || e.kind === "rewrite") {
        if (sid) {
          status.set(sid, "writing");
          current = sid;
        }
      } else if (e.kind === "verdict") {
        lastVerdict = e;
        if (e.accepted) {
          if (sid) {
            status.set(sid, "accepted");
            lastAccept = { sid, at: e.ts - t0 };
          }
        } else {
          rejections += 1;
          if (sid) status.set(sid, "rejected");
        }
      } else if (e.kind === "canon_update") {
        canonUpdates += 1;
      }
    }
    const accepted = [...status.values()].filter((s) => s === "accepted").length;
    return { status, current, lastAccept, lastVerdict, rejections, canonUpdates, accepted };
  }, [applied, t0]);

  const canonFacts = useMemo(() => {
    if (canon.length === 0) return 0;
    const total = sorted.filter((e) => e.kind === "canon_update").length;
    const idx =
      total === 0
        ? 0
        : Math.min(
            canon.length - 1,
            Math.round((model.canonUpdates / total) * (canon.length - 1)),
          );
    return canon[idx]?.facts.length ?? 0;
  }, [canon, sorted, model.canonUpdates]);

  const callsHaveTs = useMemo(
    () => calls.length > 0 && calls.every((c) => typeof c.ts === "number"),
    [calls],
  );
  const costSoFar = useMemo(() => {
    if (callsHaveTs) {
      const now = t0 + playhead;
      return calls.reduce(
        (a, c) => a + ((c.ts ?? Infinity) <= now ? c.cost_usd : 0),
        0,
      );
    }
    const n = Math.floor((duration > 0 ? playhead / duration : 1) * calls.length);
    return calls.slice(0, n).reduce((a, c) => a + c.cost_usd, 0);
  }, [calls, callsHaveTs, t0, playhead, duration]);
  const totalCost = useMemo(
    () => calls.reduce((a, c) => a + c.cost_usd, 0),
    [calls],
  );
  const totalRejections = useMemo(
    () => sorted.filter((e) => e.kind === "verdict" && !e.accepted).length,
    [sorted],
  );

  // Fast typing animation whenever a new accept lands.
  const acceptKey = model.lastAccept
    ? `${model.lastAccept.sid}@${model.lastAccept.at}`
    : "";
  const [typed, setTyped] = useState(1);
  useEffect(() => {
    setTyped(0);
    if (!acceptKey) {
      setTyped(1);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 900);
      setTyped(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [acceptKey]);

  const currentSection = model.current
    ? (sections.find((s) => s.id === model.current) ?? null)
    : null;
  const docTitle = (doc: string) =>
    documents.find((d) => d.id === doc)?.title ?? doc;
  const progress = duration > 0 ? playhead / duration : 1;

  function replay() {
    headRef.current = 0;
    setPlayhead(0);
    setFinished(false);
    setPlaying(true);
  }

  const lastVerdict = model.lastVerdict;
  const showRejection = lastVerdict !== null && !lastVerdict.accepted;
  const typedText = currentSection
    ? currentSection.text.slice(
        0,
        Math.floor(typed * currentSection.text.length),
      )
    : "";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
      <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-3">
        <h2 className="text-xl font-bold tracking-tight">
          Replaying <span className="text-emerald-300">{runLabel}</span>
        </h2>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex gap-1 rounded-md bg-zinc-800/70 p-1">
            {SPEEDS.map((s, i) => (
              <button
                key={s}
                onClick={() => setSpeedIdx(i)}
                className={cn(
                  "rounded px-2.5 py-1 font-mono text-sm font-medium outline-none",
                  i === speedIdx
                    ? "bg-zinc-950 text-zinc-100 shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200",
                )}
              >
                {s}×
              </button>
            ))}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => !finished && setPlaying((p) => !p)}
            disabled={finished}
          >
            {playing ? <Pause /> : <Play />}
            {playing ? "Pause" : "Resume"}
          </Button>
          <Button variant="ghost" size="icon" onClick={onExit} aria-label="Exit playback">
            <X />
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1.1fr_1.5fr_0.7fr] gap-4 p-4">
        <div className="flex min-h-0 flex-col gap-3 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <div className="grid flex-1 grid-cols-4 content-start gap-3">
            {documents.map((d) => {
              const list = sections
                .filter((s) => (s.doc ?? "ops") === d.id)
                .sort((a, b) => a.id.localeCompare(b.id));
              const done = list.filter(
                (s) => model.status.get(s.id) === "accepted",
              ).length;
              return (
                <div key={d.id} className="flex min-w-0 flex-col gap-2">
                  <div className="truncate text-xs font-semibold text-zinc-300" title={d.title}>
                    {d.id.toUpperCase()}{" "}
                    <span className="font-mono font-normal text-zinc-500">
                      {done}/{list.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {list.map((s) => {
                      const st = model.status.get(s.id) ?? "idle";
                      return (
                        <span
                          key={s.id}
                          title={`${s.id} · ${s.title}`}
                          className={cn(
                            "size-3.5 rounded-[3px]",
                            st === "idle" && "bg-zinc-700",
                            st === "writing" &&
                              "bg-sky-400 motion-safe:animate-pulse",
                            st === "rejected" && "tile-flash bg-rose-500",
                            st === "accepted" && "bg-emerald-500/80",
                          )}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-2 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-[2px] bg-zinc-700" /> queued
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-[2px] bg-sky-400" /> writing
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-[2px] bg-rose-500" /> rejected
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-[2px] bg-emerald-500/80" /> accepted
            </span>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          {currentSection ? (
            <>
              <div className="text-sm text-zinc-500">
                {docTitle(currentSection.doc ?? "ops")} · Ch{" "}
                {currentSection.chapter} · {currentSection.chapter_title}
              </div>
              <h3 className="text-xl font-bold">{currentSection.title}</h3>
              <p className="text-base leading-relaxed whitespace-pre-wrap text-zinc-200">
                {typedText}
                {typed < 1 && <span className="text-emerald-300">▍</span>}
              </p>
            </>
          ) : (
            <p className="text-base text-zinc-500">
              Waiting for the first draft…
            </p>
          )}
          {showRejection && lastVerdict?.quote && (
            <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 p-4">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="danger">critic rejected</Badge>
                <span className="font-mono text-xs text-zinc-400">
                  {sidOf(lastVerdict) ?? ""}
                </span>
              </div>
              <p className="text-base text-rose-100 italic">
                “{lastVerdict.quote}”
              </p>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-auto">
          {[
            {
              label: "Sections accepted",
              value: `${model.accepted} / ${sections.length}`,
            },
            { label: "Critic rejections", value: String(model.rejections) },
            { label: "Canon facts", value: String(canonFacts) },
            { label: "Cost so far", value: `$${costSoFar.toFixed(2)}` },
          ].map((c) => (
            <div
              key={c.label}
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
            >
              <div className="text-xs tracking-wide text-zinc-500 uppercase">
                {c.label}
              </div>
              <div className="mt-1 font-mono text-3xl font-bold">
                {c.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-zinc-800 px-5 py-3">
        <span className="text-sm whitespace-nowrap text-zinc-300">
          {fmtDur(playhead)}{" "}
          <span className="text-zinc-500">
            of {fmtDur(duration)} of generation
          </span>
        </span>
        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <span className="font-mono text-sm text-zinc-500">
          {Math.round(progress * 100)}%
        </span>
        <span className="hidden text-xs text-zinc-600 lg:block">
          Space pause · ←/→ speed · Esc exit
        </span>
      </div>

      {finished && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-zinc-950 p-8 text-center shadow-2xl">
            <h3 className="text-2xl font-bold">Run complete</h3>
            <p className="mt-3 text-lg leading-relaxed text-zinc-200">
              {sections.length} sections · {documents.length} documents ·{" "}
              {totalRejections} rejection
              {totalRejections === 1 ? "" : "s"} caught by the critic · $
              {totalCost.toFixed(2)} · {betweenDocs} contradictions between
              documents
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <Button variant="secondary" onClick={replay}>
                <RotateCcw /> Replay
              </Button>
              <Button onClick={onExit}>Exit</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

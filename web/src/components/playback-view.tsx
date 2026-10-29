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
import { useT, type Lang } from "@/lib/i18n";
import { LocLabel } from "./shell";
import { cn } from "@/lib/utils";

const SPEEDS = [10, 30, 60, 120] as const;
const DEFAULT_SPEED_IDX = 2;

type Status = "idle" | "writing" | "rejected" | "accepted";

function sidOf(e: AgentEvent): string | null {
  return typeof e.section_id === "string" ? e.section_id : null;
}

function fmtDur(seconds: number, lang: Lang): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} ${lang === "pl" ? "g" : "h"} ${String(m % 60).padStart(2, "0")} min`;
}

function tileClass(st: Status): string {
  if (st === "writing") return "bg-ink-soft motion-safe:animate-pulse";
  if (st === "rejected") return "tile-flash bg-hazard";
  if (st === "accepted") return "bg-ink";
  return "border border-rule bg-label";
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
  const { t, tn, lang } = useT();
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
      // Cap the step: after a hidden tab rAF resumes with a huge gap that would jump to the end card.
      const dt = Math.min((now - last) / 1000, 0.1);
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

  // Fast typing animation whenever a new accept lands; skipped for reduced motion.
  const acceptKey = model.lastAccept
    ? `${model.lastAccept.sid}@${model.lastAccept.at}`
    : "";
  const [typed, setTyped] = useState(1);
  useEffect(() => {
    if (!acceptKey) {
      setTyped(1);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyped(1);
      return;
    }
    setTyped(0);
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
    <div
      className="fixed inset-0 z-50 flex flex-col bg-concrete"
      role="dialog"
      aria-modal="true"
      aria-label={`${t("play.replaying")} ${runLabel}`}
    >
      <div className="flex flex-wrap items-center gap-3 border-b-[1.5px] border-ink bg-label px-6 py-3">
        <h2 className="font-display text-[24px] font-semibold uppercase leading-none tracking-[0.02em]">
          {t("play.replaying")} {runLabel}
        </h2>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex border-[1.5px] border-ink" role="group" aria-label={`${SPEEDS.join(" / ")}×`}>
            {SPEEDS.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeedIdx(i)}
                aria-pressed={i === speedIdx}
                className={cn(
                  "px-3 py-1.5 font-mono text-[14px] font-semibold",
                  i === speedIdx ? "bg-ink text-label" : "hover:bg-concrete",
                )}
              >
                {s}×
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => !finished && setPlaying((p) => !p)}
            disabled={finished}
            className="flex items-center gap-2 border-[1.5px] border-ink bg-label px-3 py-1.5 font-display text-[16px] font-semibold uppercase tracking-[0.04em] disabled:opacity-40"
          >
            {playing ? (
              <>
                <Pause size={14} aria-hidden /> {t("yo.pause")}
              </>
            ) : (
              <>
                <Play size={14} aria-hidden /> {t("yo.play")}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onExit}
            aria-label={t("yo.exit")}
            className="border-[1.5px] border-ink bg-ink p-2 text-label"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1.1fr_1.5fr_0.8fr] max-lg:grid-cols-1 max-lg:overflow-y-auto">
        <div className="flex min-h-0 flex-col border-r-[1.5px] border-ink bg-label max-lg:border-r-0 max-lg:border-b-[1.5px]">
          <div className="grid flex-1 content-start grid-cols-4 gap-3 overflow-auto p-4">
            {documents.map((d) => {
              const list = sections
                .filter((s) => (s.doc ?? "ops") === d.id)
                .sort((a, b) => a.id.localeCompare(b.id));
              const done = list.filter(
                (s) => model.status.get(s.id) === "accepted",
              ).length;
              return (
                <div key={d.id} className="flex min-w-0 flex-col gap-2">
                  <div className="truncate font-display text-[15px] font-semibold uppercase tracking-[0.05em]" title={d.title}>
                    {d.id}{" "}
                    <span className="font-mono font-normal normal-case text-ink-soft">
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
                          className={cn("size-3.5", tileClass(st))}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t-[1.5px] border-ink px-4 py-2 text-[12px] text-ink-soft">
            <span className="flex items-center gap-1">
              <span className="size-2.5 border border-rule bg-label" /> {t("play.queued")}
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 bg-ink-soft" /> {t("play.writing")}
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 bg-hazard" /> {t("play.rejected")}
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2.5 bg-ink" /> {t("play.accepted")}
            </span>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-auto px-6 py-5">
          {currentSection ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <LocLabel id={currentSection.id} size={15} />
                <span className="text-[14px] text-ink-soft">
                  {docTitle(currentSection.doc ?? "ops")} · {t("play.chapter")}{" "}
                  {currentSection.chapter} · {currentSection.chapter_title}
                </span>
              </div>
              <h3 className="font-display text-[28px] font-semibold uppercase leading-none tracking-[0.01em]">
                {currentSection.title}
              </h3>
              <p className="max-w-[72ch] whitespace-pre-wrap text-[16px] leading-relaxed">
                {typedText}
                {typed < 1 && <span aria-hidden>▍</span>}
              </p>
            </>
          ) : (
            <p className="text-[18px] text-ink-soft">{t("play.waiting")}</p>
          )}
          {showRejection && lastVerdict?.quote && (
            <div className="border-[1.5px] border-hazard bg-label p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="bg-hazard px-1.5 py-0.5 font-mono text-[11px] uppercase text-label">
                  {t("play.critic_rejected")}
                </span>
                {sidOf(lastVerdict) && <LocLabel id={sidOf(lastVerdict) as string} size={12} />}
              </div>
              <p className="border-l-2 border-hazard pl-2 text-[16px] italic">
                &ldquo;{lastVerdict.quote}&rdquo;
              </p>
            </div>
          )}
        </div>

        <div className="flex min-h-0 flex-col overflow-auto border-l-[1.5px] border-ink bg-label max-lg:border-l-0 max-lg:border-t-[1.5px]">
          {[
            {
              label: t("play.sections_accepted"),
              value: `${model.accepted} / ${sections.length}`,
            },
            { label: t("play.rejections"), value: String(model.rejections) },
            { label: t("play.canon_facts"), value: String(canonFacts) },
            { label: t("play.cost_so_far"), value: `$${costSoFar.toFixed(2)}` },
          ].map((c, i, arr) => (
            <div
              key={c.label}
              className={`px-5 py-4 ${i < arr.length - 1 ? "border-b border-rule" : ""}`}
            >
              <div className="font-display text-[15px] font-semibold uppercase tracking-[0.05em] text-ink-soft">
                {c.label}
              </div>
              <div className="mt-1 font-mono text-[32px] font-semibold leading-none tabular-nums">
                {c.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 border-t-[1.5px] border-ink bg-label px-6 py-3">
        <span className="whitespace-nowrap text-[14px]">
          {fmtDur(playhead, lang)}{" "}
          <span className="text-ink-soft">
            {t("yo.of")} {fmtDur(duration, lang)} {t("play.generation")}
          </span>
        </span>
        <div className="h-2 min-w-0 flex-1 bg-concrete-deep">
          <div className="h-full bg-ink" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <span className="font-mono text-[14px] text-ink-soft">
          {Math.round(progress * 100)}%
        </span>
        <span className="hidden text-[12px] text-ink-soft lg:block">{t("play.hint")}</span>
      </div>

      {finished && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink/70 p-4">
          <div className="w-full max-w-2xl border-[1.5px] border-ink bg-label p-8 text-center">
            <h3 className="font-display text-[28px] font-semibold uppercase tracking-[0.02em]">
              {t("play.complete")}
            </h3>
            <p className="mt-3 text-[18px] leading-relaxed">
              {sections.length} {tn("n.sections", sections.length)} ·{" "}
              {documents.length} {tn("n.documents", documents.length)} ·{" "}
              {totalRejections} {tn("n.rejections_caught", totalRejections)} · $
              {totalCost.toFixed(2)} · {betweenDocs}{" "}
              {tn("n.contradictions_between", betweenDocs)}
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={replay}
                className="flex items-center gap-2 border-[1.5px] border-ink bg-label px-4 py-2 font-display text-[16px] font-semibold uppercase tracking-[0.04em]"
              >
                <RotateCcw size={14} aria-hidden /> {t("yo.replay")}
              </button>
              <button
                type="button"
                onClick={onExit}
                className="flex items-center gap-2 border-[1.5px] border-ink bg-ink px-4 py-2 font-display text-[16px] font-semibold uppercase tracking-[0.04em] text-label"
              >
                <X size={14} aria-hidden /> {t("yo.exit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

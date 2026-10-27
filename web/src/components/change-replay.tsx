"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type {
  AgentEvent,
  ChangeNotice,
  DocumentInfo,
  Fact,
  FactChangeRecord,
  Section,
} from "@/lib/types";
import { Badge, Button } from "./ui";
import { ChangeGraph } from "./change-graph";
import { ChangeDiff } from "./change-diff";
import type { OpenSection } from "./maintenance-tab";
import { cn } from "@/lib/utils";

const BASE_STEPS = ["Dependencies", "Rewrite log", "Before / after"] as const;

function NoticesStep({
  notices,
  sections,
  onOpenSection,
  onClose,
}: {
  notices: ChangeNotice[];
  sections: Section[];
  onOpenSection: OpenSection;
  onClose: () => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {notices.map((n, i) => {
        const issues = n.unresolved_issues.length;
        return (
          <article
            key={`${n.audience}-${i}`}
            className="flex flex-col gap-3 rounded-lg bg-amber-50 p-5 text-stone-900 shadow-lg"
          >
            <div className="text-[11px] font-bold tracking-widest text-stone-500 uppercase">
              {n.audience === "client" ? "For clients" : "For staff"}
            </div>
            <h4 className="text-base font-bold">{n.subject}</h4>
            <p className="text-sm leading-relaxed whitespace-pre-line">
              {n.body}
            </p>
            {n.cited_section_ids.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {n.cited_section_ids.map((sid) => {
                  const section = sections.find((s) => s.id === sid);
                  if (!section) {
                    return (
                      <span
                        key={sid}
                        className="rounded-full border border-stone-300 px-2 py-0.5 font-mono text-[11px] text-stone-500"
                      >
                        {sid}
                      </span>
                    );
                  }
                  return (
                    <button
                      key={sid}
                      onClick={() => {
                        onOpenSection("psyche", section.doc ?? "ops", sid);
                        onClose();
                      }}
                      title={section.title}
                      className="rounded-full border border-stone-400 px-2 py-0.5 font-mono text-[11px] text-stone-800 outline-none hover:bg-stone-900 hover:text-amber-50"
                    >
                      {sid}
                    </button>
                  );
                })}
              </div>
            )}
            <div>
              {issues === 0 ? (
                <span className="inline-block rounded-full border border-emerald-700/50 bg-emerald-700/10 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                  checked by critic ✓
                </span>
              ) : (
                <span className="inline-block rounded-full border border-amber-700/50 bg-amber-700/10 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  {issues} issue{issues === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function formatDelta(ts: number, t0: number): string {
  const d = Math.max(0, Math.floor(ts - t0));
  return `T+${String(Math.floor(d / 60)).padStart(2, "0")}:${String(d % 60).padStart(2, "0")}`;
}

function RewriteLog({ events }: { events: AgentEvent[] }) {
  const t0 = events.length > 0 ? events[0].ts : 0;
  return (
    <ol className="relative ml-1 flex flex-col gap-4 border-l border-zinc-800 py-1 pl-5">
      {events.map((e, i) => {
        const rejected = e.kind === "verdict" && e.accepted === false;
        return (
          <li
            key={`${e.ts}-${i}`}
            className="replay-rise relative"
            style={{ animationDelay: `${Math.min(i, 12) * 80}ms` }}
          >
            <span
              className={cn(
                "absolute top-1.5 -left-[26px] size-2.5 rounded-full",
                e.kind === "verdict" && e.accepted && "bg-emerald-400",
                rejected && "bg-rose-400",
                e.kind === "draft" && "bg-emerald-400/70",
                e.kind === "rewrite" && "bg-amber-400",
                e.kind !== "verdict" &&
                  e.kind !== "draft" &&
                  e.kind !== "rewrite" &&
                  "bg-zinc-500",
              )}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-zinc-500">
                {formatDelta(e.ts, t0)}
              </span>
              <Badge
                variant={
                  e.agent === "writer"
                    ? "default"
                    : e.agent === "critic"
                      ? "warn"
                      : "secondary"
                }
              >
                {e.agent}
              </Badge>
              <Badge variant="outline" className="font-mono text-[11px]">
                {e.model}
              </Badge>
              {e.section_id && (
                <Badge variant="outline" className="font-mono text-[11px]">
                  {e.section_id}
                </Badge>
              )}
              {e.kind === "verdict" && (
                <Badge variant={e.accepted ? "default" : "danger"}>
                  {e.accepted ? "accepted" : "rejected"}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-base text-zinc-200">{e.message}</p>
            {e.quote && (
              <blockquote
                className={cn(
                  "mt-1.5 rounded-md border-l-2 px-3 py-1.5 text-base italic",
                  rejected
                    ? "border-rose-400/70 bg-rose-500/10 text-rose-100"
                    : "border-zinc-700 bg-zinc-800/50 text-zinc-300",
                )}
              >
                “{e.quote}”
              </blockquote>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function ChangeReplay({
  record,
  fact,
  sections,
  documents,
  onClose,
  onOpenSection,
}: {
  record: FactChangeRecord;
  fact: Fact | undefined;
  sections: Section[];
  documents: DocumentInfo[];
  onClose: () => void;
  onOpenSection: OpenSection;
}) {
  const [step, setStep] = useState(0);
  const { change } = record;
  const unit = fact?.unit ? ` ${fact.unit}` : "";
  const notices = record.notices ?? [];
  const steps: readonly string[] =
    notices.length > 0 ? [...BASE_STEPS, "Notices"] : BASE_STEPS;
  const lastStep = steps.length - 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setStep((s) => Math.min(lastStep, s + 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, lastStep]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Replay change ${change.fact_id}`}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 border-b border-zinc-800 p-5 pb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              Replay change:{" "}
              <span className="font-mono text-emerald-300">
                {change.fact_id}
              </span>
            </h2>
            <p className="mt-1 text-base text-zinc-300">
              {fact ? `${fact.subject}.${fact.attribute}: ` : ""}
              <span className="font-mono text-rose-300 line-through">
                {change.old_value}
              </span>{" "}
              <span className="text-zinc-500">→</span>{" "}
              <span className="font-mono text-emerald-300">
                {change.new_value}
              </span>
              {unit}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close replay"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-zinc-800 px-5 py-3">
          {steps.map((label, i) => (
            <button
              key={label}
              onClick={() => setStep(i)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                step === i
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300",
              )}
            >
              {i + 1}. {label}
            </button>
          ))}
          <span className="ml-auto text-sm text-zinc-500">
            Step {step + 1} of {steps.length}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          {step === 0 && (
            <div className="flex h-[52vh] min-h-[360px] flex-col">
              <ChangeGraph
                factId={change.fact_id}
                factLabel={
                  fact ? `${fact.subject}.${fact.attribute}` : change.fact_id
                }
                affected={change.affected_sections}
                sections={sections}
                documents={documents}
              />
            </div>
          )}
          {step === 1 && <RewriteLog events={record.events} />}
          {step === 2 && <ChangeDiff diffs={record.diff} />}
          {step === 3 && notices.length > 0 && (
            <NoticesStep
              notices={notices}
              sections={sections}
              onOpenSection={onOpenSection}
              onClose={onClose}
            />
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 px-5 py-3">
          <Button
            variant="secondary"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ArrowLeft /> Back
          </Button>
          <span className="text-xs text-zinc-600">
            ← → to step, Esc to close
          </span>
          <Button
            onClick={() => setStep((s) => Math.min(lastStep, s + 1))}
            disabled={step === lastStep}
          >
            Next <ArrowRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

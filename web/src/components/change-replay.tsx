"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import type {
  AgentEvent,
  ChangeNotice,
  DocumentInfo,
  Fact,
  FactChangeRecord,
  OpenSection,
  Section,
} from "@/lib/types";
import { useT } from "@/lib/i18n";
import { ChangeGraph } from "./change-graph";
import { ChangeDiff } from "./change-diff";
import { LocLabel } from "./shell";
import { cn } from "@/lib/utils";

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
  const { t, tn } = useT();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {notices.map((n, i) => {
        const issues = n.unresolved_issues.length;
        return (
          <article
            key={`${n.audience}-${i}`}
            className="flex flex-col gap-3 border-[1.5px] border-ink bg-label p-5"
          >
            <div className="font-display text-[14px] font-semibold uppercase tracking-[0.08em] text-ink-soft">
              {n.audience === "client" ? t("replay.for_clients") : t("replay.for_staff")}
            </div>
            <h4 className="text-[17px] font-bold">{n.subject}</h4>
            <p className="text-[14px] leading-relaxed whitespace-pre-line">{n.body}</p>
            {n.cited_section_ids.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {n.cited_section_ids.map((sid) => {
                  const section = sections.find((s) => s.id === sid);
                  if (!section) {
                    return (
                      <span
                        key={sid}
                        className="border border-rule px-2 py-0.5 font-mono text-[11px] text-ink-soft"
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
                      className="underline decoration-rule underline-offset-2 hover:decoration-ink"
                    >
                      <LocLabel id={sid} size={11} />
                    </button>
                  );
                })}
              </div>
            )}
            <div>
              {issues === 0 ? (
                <span className="inline-flex items-center gap-1.5 border border-ink px-2 py-0.5 text-[12px] font-medium">
                  <Check size={13} aria-hidden /> {t("replay.checked")}
                </span>
              ) : (
                <span className="inline-block bg-hazard px-2 py-0.5 text-[12px] font-medium text-label">
                  {issues} {tn("n.issues", issues)}
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

function dotClass(e: AgentEvent): string {
  if (e.kind === "verdict") return e.accepted ? "bg-ink" : "bg-hazard";
  if (e.kind === "rewrite") return "bg-hazard";
  if (e.kind === "draft") return "bg-ink-soft";
  return "bg-rule";
}

function RewriteLog({ events }: { events: AgentEvent[] }) {
  const { t } = useT();
  const t0 = events.length > 0 ? events[0].ts : 0;
  return (
    <ol className="relative ml-1 flex flex-col gap-4 border-l-[1.5px] border-ink py-1 pl-5">
      {events.map((e, i) => {
        const rejected = e.kind === "verdict" && e.accepted === false;
        return (
          <li
            key={`${e.ts}-${i}`}
            className="replay-rise relative"
            style={{ animationDelay: `${Math.min(i, 12) * 80}ms` }}
          >
            <span
              className={cn("absolute top-1.5 -left-[27px] size-2.5", dotClass(e))}
              aria-hidden
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[12px] text-ink-soft">
                {formatDelta(e.ts, t0)}
              </span>
              <span className="bg-ink px-1.5 py-0.5 font-mono text-[11px] uppercase text-label">
                {e.agent}
              </span>
              <span className="border border-rule px-1.5 py-0.5 font-mono text-[11px] text-ink-soft">
                {e.model}
              </span>
              {e.section_id && <LocLabel id={e.section_id} size={11} />}
              {e.kind === "verdict" && (
                <span
                  className={cn(
                    "px-1.5 py-0.5 font-mono text-[11px] uppercase",
                    e.accepted ? "bg-ink text-label" : "bg-hazard text-label",
                  )}
                >
                  {e.accepted ? t("play.accepted") : t("play.rejected")}
                </span>
              )}
            </div>
            <p className="mt-1 text-[15px]">{e.message}</p>
            {e.quote && (
              <blockquote
                className={cn(
                  "mt-1.5 border-l-2 px-3 py-1.5 text-[15px] italic",
                  rejected
                    ? "border-hazard bg-hazard-soft"
                    : "border-rule bg-concrete",
                )}
              >
                &ldquo;{e.quote}&rdquo;
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
  const { t } = useT();
  const [step, setStep] = useState(0);
  const { change } = record;
  const unit = fact?.unit ? ` ${fact.unit}` : "";
  const notices = record.notices ?? [];
  const steps: string[] = [
    t("replay.step_deps"),
    t("replay.step_log"),
    t("replay.step_diff"),
    ...(notices.length > 0 ? [t("replay.step_notices")] : []),
  ];
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${t("graph.replay")} ${change.fact_id}`}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col border-[1.5px] border-ink bg-label"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 border-b-[1.5px] border-ink p-5 pb-4">
          <div>
            <h2 className="font-display text-[26px] font-semibold uppercase leading-none tracking-[0.02em]">
              {t("graph.replay")}: <span className="font-mono">{change.fact_id}</span>
            </h2>
            <p className="mt-2 text-[16px]">
              {fact ? `${fact.subject}.${fact.attribute}: ` : ""}
              <span className="font-mono text-ink-soft line-through">
                {change.old_value}
              </span>{" "}
              <span className="text-ink-soft">→</span>{" "}
              <span className="font-mono font-bold">{change.new_value}</span>
              {unit}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("replay.close")}
            className="ml-auto border-[1.5px] border-ink p-1.5 hover:bg-concrete"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b-[1.5px] border-ink px-5 py-3">
          {steps.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i)}
              aria-current={step === i ? "step" : undefined}
              className={cn(
                "px-3 py-1.5 font-display text-[16px] font-semibold uppercase tracking-[0.04em]",
                step === i ? "bg-ink text-label" : "hover:bg-concrete",
              )}
            >
              {i + 1}. {label}
            </button>
          ))}
          <span className="ml-auto text-[14px] text-ink-soft">
            {t("replay.step")} {step + 1} / {steps.length}
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

        <div className="flex items-center justify-between gap-2 border-t-[1.5px] border-ink px-5 py-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-2 border-[1.5px] border-ink bg-label px-4 py-2 font-display text-[16px] font-semibold uppercase tracking-[0.04em] disabled:opacity-40"
          >
            <ArrowLeft size={14} aria-hidden /> {t("replay.back")}
          </button>
          <span className="text-[13px] text-ink-soft">{t("replay.hint")}</span>
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(lastStep, s + 1))}
            disabled={step === lastStep}
            className="flex items-center gap-2 border-[1.5px] border-ink bg-ink px-4 py-2 font-display text-[16px] font-semibold uppercase tracking-[0.04em] text-label disabled:opacity-40"
          >
            {t("replay.next")} <ArrowRight size={14} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

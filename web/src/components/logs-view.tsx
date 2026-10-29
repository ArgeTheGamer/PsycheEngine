"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AgentEvent } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { AgentFlow } from "./agent-flow";
import { LocLabel } from "./shell";
import { cn } from "@/lib/utils";

function dotClass(e: AgentEvent): string {
  if (e.kind === "verdict") return e.accepted ? "bg-ink" : "bg-hazard";
  if (e.kind === "rewrite") return "bg-hazard";
  if (e.kind === "draft") return "bg-ink-soft";
  return "bg-rule";
}

function formatTs(seconds: number): string {
  const ts = Math.floor(seconds); // engine timestamps are float epoch seconds
  const m = Math.floor(ts / 60);
  const s = ts % 60;
  return `T+${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function EventRow({
  event,
  t0,
  expanded,
  onToggle,
}: {
  event: AgentEvent;
  t0: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useT();
  const rejected = event.kind === "verdict" && event.accepted === false;
  return (
    <li className="relative">
      <span
        className={cn("absolute top-1.5 -left-[21px] size-2", dotClass(event))}
        aria-hidden
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className="font-mono text-[12px] text-ink-soft"
          title={new Date(event.ts * 1000).toISOString()}
        >
          {formatTs(Math.max(0, event.ts - t0))}
        </span>
        <span className="bg-ink px-1.5 py-0.5 font-mono text-[11px] uppercase text-label">
          {event.agent}
        </span>
        <span className="border border-rule px-1.5 py-0.5 font-mono text-[11px] text-ink-soft">
          {event.model}
        </span>
        {event.section_id && <LocLabel id={event.section_id} size={11} />}
        {event.kind === "verdict" && (
          <span
            className={cn(
              "px-1.5 py-0.5 font-mono text-[11px] uppercase",
              event.accepted ? "bg-ink text-label" : "bg-hazard text-label",
            )}
          >
            {event.accepted ? t("play.accepted") : t("play.rejected")}
          </span>
        )}
        {event.quote && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? t("logs.collapse") : t("logs.expand")}
            aria-expanded={expanded}
            className="ml-auto border border-rule p-1 hover:border-ink"
          >
            <ChevronDown
              size={14}
              aria-hidden
              className={cn(expanded && "rotate-180")}
            />
          </button>
        )}
      </div>
      <p className="mt-1 max-w-[80ch] text-[14px]">{event.message}</p>
      {expanded && event.quote && (
        <blockquote
          className={cn(
            "mt-1.5 max-w-[80ch] border-l-2 px-3 py-1.5 text-[14px] italic",
            rejected ? "border-hazard bg-hazard-soft" : "border-rule bg-concrete",
          )}
        >
          &ldquo;{event.quote}&rdquo;
        </blockquote>
      )}
    </li>
  );
}

export function LogsView({ events }: { events: AgentEvent[] }) {
  const { t } = useT();
  const [expanded, setExpanded] = useState<number | null>(null);
  const t0 = events.length > 0 ? events[0].ts : 0;
  const verdicts = events.filter((e) => e.kind === "verdict");
  const accepted = verdicts.filter((e) => e.accepted).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 border-b-[1.5px] border-ink bg-label px-6 py-4">
        <h2 className="font-display text-[22px] font-semibold uppercase tracking-[0.04em]">
          {t("logs.title")}
        </h2>
        <div className="ml-auto flex items-center gap-2 text-[13px]">
          <span className="border-[1.5px] border-ink px-2 py-1 font-mono">
            {accepted} {t("play.accepted")}
          </span>
          <span
            className={cn(
              "px-2 py-1 font-mono",
              verdicts.length - accepted > 0
                ? "bg-hazard text-label"
                : "border border-rule text-ink-soft",
            )}
          >
            {verdicts.length - accepted} {t("play.rejected")}
          </span>
        </div>
      </div>
      <AgentFlow />
      {events.length === 0 ? (
        <p className="m-6 text-[14px] text-ink-soft">{t("logs.empty")}</p>
      ) : (
        <ol className="relative ml-6 flex flex-col gap-3 border-l-[1.5px] border-ink py-4 pl-4 pr-6">
          {events.map((e, i) => (
            <EventRow
              key={`${e.ts}-${i}`}
              event={e}
              t0={t0}
              expanded={expanded === i}
              onToggle={() => setExpanded(expanded === i ? null : i)}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

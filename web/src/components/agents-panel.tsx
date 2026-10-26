"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AgentEvent } from "@/lib/types";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "./ui";
import { AgentFlow } from "./agent-flow";
import { cn } from "@/lib/utils";

const AGENT_VARIANT: Record<string, "info" | "default" | "warn" | "secondary"> =
  {
    planner: "info",
    writer: "default",
    critic: "warn",
    canon_editor: "secondary",
  };

function dotColor(e: AgentEvent): string {
  if (e.kind === "verdict") return e.accepted ? "#34d399" : "#fb7185";
  if (e.kind === "rewrite") return "#fbbf24";
  if (e.kind === "plan") return "#38bdf8";
  if (e.kind === "draft") return "#34d399";
  return "#a1a1aa";
}

function formatTs(ts: number): string {
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
  return (
    <li className="relative">
      <span
        className="absolute top-1.5 -left-[21px] size-2 rounded-full"
        style={{ background: dotColor(event) }}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className="font-mono text-[11px] text-zinc-500"
          title={new Date(event.ts * 1000).toISOString()}
        >
          {formatTs(Math.max(0, event.ts - t0))}
        </span>
        <Badge variant={AGENT_VARIANT[event.agent] ?? "secondary"}>
          {event.agent}
        </Badge>
        <Badge variant="outline" className="font-mono text-[10px]">
          {event.model}
        </Badge>
        {event.section_id && (
          <Badge variant="outline" className="font-mono text-[10px]">
            {event.section_id}
          </Badge>
        )}
        {event.kind === "verdict" && (
          <Badge variant={event.accepted ? "default" : "danger"}>
            {event.accepted ? "accepted" : "rejected"}
          </Badge>
        )}
        {event.quote && (
          <button
            onClick={onToggle}
            className="ml-auto rounded p-0.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label={expanded ? "Collapse details" : "Expand details"}
          >
            <ChevronDown
              className={cn("size-4 transition-transform", expanded && "rotate-180")}
            />
          </button>
        )}
      </div>
      <p className="mt-0.5 text-xs text-zinc-300">{event.message}</p>
      {expanded && event.quote && (
        <blockquote className="mt-1 rounded-md border-l-2 border-amber-400/60 bg-zinc-800/50 px-2 py-1 text-xs text-zinc-300 italic">
          “{event.quote}”
        </blockquote>
      )}
    </li>
  );
}

export function AgentsPanel({ events }: { events: AgentEvent[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const t0 = events.length > 0 ? events[0].ts : 0;
  const verdicts = events.filter((e) => e.kind === "verdict");
  const accepted = verdicts.filter((e) => e.accepted).length;

  return (
    <Card className="min-h-[440px] xl:h-[calc((100vh-112px)/2)] xl:min-h-[400px]">
      <CardHeader>
        <CardTitle>Agent log</CardTitle>
        <div className="ml-auto flex items-center gap-1.5">
          <Badge variant="default">{accepted} accepted</Badge>
          <Badge variant="danger">
            {verdicts.length - accepted} rejected
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 gap-2">
        <AgentFlow />
        <ol className="relative ml-1 flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto border-l border-zinc-800 py-1 pl-4">
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
      </CardContent>
    </Card>
  );
}

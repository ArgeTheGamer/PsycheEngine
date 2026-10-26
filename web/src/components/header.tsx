"use client";

import { Boxes } from "lucide-react";
import type { RunInfo } from "@/lib/types";
import {
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui";

export function Header({
  runs,
  runId,
  onRunChange,
  rewritten,
  untouched,
  docCount,
}: {
  runs: RunInfo[];
  runId: string;
  onRunChange: (id: string) => void;
  rewritten?: number;
  untouched?: number;
  docCount?: number;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400">
          <Boxes className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg leading-tight font-bold tracking-tight">
            PsycheEngine
          </h1>
          <p className="text-xs text-zinc-300">
            Consistent warehouse manuals on Muse Spark
          </p>
        </div>
        {docCount !== undefined && (
          <Badge variant="secondary" className="ml-2 hidden sm:inline-flex">
            {docCount} document{docCount === 1 ? "" : "s"} · 1 canon
          </Badge>
        )}
        {rewritten !== undefined && untouched !== undefined && (
          <p className="ml-auto hidden text-xs text-zinc-400 md:block">
            Rewritten{" "}
            <span className="font-mono font-semibold text-emerald-300">
              {rewritten}
            </span>{" "}
            sections, untouched{" "}
            <span className="font-mono font-semibold text-zinc-200">
              {untouched}
            </span>
          </p>
        )}
        <div
          className={
            rewritten === undefined ? "ml-auto flex items-center gap-2" : "flex items-center gap-2"
          }
        >
          <span className="text-xs text-zinc-400">Run</span>
          <Select value={runId} onValueChange={onRunChange}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a run" />
            </SelectTrigger>
            <SelectContent>
              {runs.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </header>
  );
}

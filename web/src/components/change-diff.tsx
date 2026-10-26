"use client";

import { useMemo } from "react";
import { diffWords } from "diff";

type DiffEntry = {
  section_id: string;
  title: string;
  before: string;
  after: string;
};

function DiffPane({
  text,
  counterpart,
  side,
}: {
  text: string;
  counterpart: string;
  side: "before" | "after";
}) {
  const parts = useMemo(
    () =>
      side === "before"
        ? diffWords(text, counterpart)
        : diffWords(counterpart, text),
    [text, counterpart, side],
  );
  return (
    <p className="text-sm leading-relaxed whitespace-pre-wrap">
      {parts.map((p, i) => {
        if (p.added) {
          return side === "after" ? (
            <span
              key={i}
              className="rounded bg-emerald-500/25 px-0.5 text-emerald-200"
            >
              {p.value}
            </span>
          ) : null;
        }
        if (p.removed) {
          return side === "before" ? (
            <span
              key={i}
              className="rounded bg-rose-500/25 px-0.5 text-rose-200 line-through"
            >
              {p.value}
            </span>
          ) : null;
        }
        return (
          <span key={i} className="text-zinc-300">
            {p.value}
          </span>
        );
      })}
    </p>
  );
}

export function ChangeDiff({ diffs }: { diffs: DiffEntry[] }) {
  if (diffs.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No sections were rewritten.</p>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {diffs.map((d) => (
        <section key={d.section_id}>
          <h4 className="mb-2 flex items-center gap-2 text-base font-semibold">
            {d.title}
            <span className="font-mono text-xs font-normal text-zinc-500">
              {d.section_id}
            </span>
          </h4>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
              <div className="mb-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                Before
              </div>
              <DiffPane text={d.before} counterpart={d.after} side="before" />
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
              <div className="mb-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                After
              </div>
              <DiffPane text={d.after} counterpart={d.before} side="after" />
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

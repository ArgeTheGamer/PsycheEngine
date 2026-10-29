"use client";

import { useMemo } from "react";
import { diffWords } from "diff";
import { useT } from "@/lib/i18n";

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
    <p className="text-[14px] leading-relaxed whitespace-pre-wrap">
      {parts.map((p, i) => {
        if (p.added) {
          return side === "after" ? (
            <span key={i} className="bg-concrete-deep px-0.5 font-bold">
              {p.value}
            </span>
          ) : null;
        }
        if (p.removed) {
          return side === "before" ? (
            <span key={i} className="bg-hazard-soft px-0.5 line-through">
              {p.value}
            </span>
          ) : null;
        }
        return <span key={i}>{p.value}</span>;
      })}
    </p>
  );
}

export function ChangeDiff({ diffs }: { diffs: DiffEntry[] }) {
  const { t } = useT();
  if (diffs.length === 0) {
    return <p className="text-[14px] text-ink-soft">{t("replay.no_rewrite")}</p>;
  }
  return (
    <div className="flex flex-col gap-5">
      {diffs.map((d) => (
        <section key={d.section_id}>
          <h4 className="mb-2 flex flex-wrap items-baseline gap-2">
            <span className="font-display text-[18px] font-semibold uppercase tracking-[0.03em]">
              {d.title}
            </span>
            <span className="font-mono text-[12px] text-ink-soft">{d.section_id}</span>
          </h4>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="border border-rule bg-concrete p-3">
              <div className="mb-1.5 font-display text-[14px] font-semibold uppercase tracking-[0.05em] text-ink-soft">
                {t("replay.before")}
              </div>
              <DiffPane text={d.before} counterpart={d.after} side="before" />
            </div>
            <div className="border border-rule bg-concrete p-3">
              <div className="mb-1.5 font-display text-[14px] font-semibold uppercase tracking-[0.05em] text-ink-soft">
                {t("replay.after")}
              </div>
              <DiffPane text={d.after} counterpart={d.before} side="after" />
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

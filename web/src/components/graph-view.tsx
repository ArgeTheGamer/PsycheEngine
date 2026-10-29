"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type {
  CanonVersion,
  DocumentInfo,
  Fact,
  FactChangeRecord,
  Section,
} from "@/lib/types";
import { useT, type StringKey } from "@/lib/i18n";
import { LocLabel } from "./shell";

function versionLabel(v: number) {
  return `v${String(v).padStart(2, "0")}`;
}

function FactPane({
  fact,
  change,
  usageByDoc,
  usageCount,
  docTitleById,
  onReplay,
  onClose,
}: {
  fact: Fact;
  change: FactChangeRecord | null;
  usageByDoc: [string, Section[]][];
  usageCount: number;
  docTitleById: Map<string, string>;
  onReplay: (change: FactChangeRecord) => void;
  onClose: () => void;
}) {
  const { t, tn } = useT();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b-[1.5px] border-ink px-5 pb-4 pt-5">
        <div className="flex items-start gap-2">
          <h2 className="font-mono text-[20px] font-bold">{fact.id}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("graph.close")}
            className="ml-auto border-[1.5px] border-ink p-1 hover:bg-concrete"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="bg-ink px-1.5 py-0.5 font-mono text-[11px] uppercase text-label">
            {t(`cat.${fact.category}` as StringKey)}
          </span>
          <span className="border border-rule px-1.5 py-0.5 font-mono text-[11px] text-ink-soft">
            {fact.source}
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <p className="text-[15px] leading-relaxed">{fact.statement}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border border-rule p-3 text-[13px]">
          <div>
            <dt className="text-ink-soft">{t("graph.subject")}</dt>
            <dd className="font-mono">{fact.subject}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">{t("graph.attribute")}</dt>
            <dd className="font-mono">{fact.attribute}</dd>
          </div>
          <div>
            <dt className="text-ink-soft">{t("graph.col_value")}</dt>
            <dd className="font-mono">
              {fact.value}
              {fact.unit ? ` ${fact.unit}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-ink-soft">{t("graph.source")}</dt>
            <dd>{fact.source}</dd>
          </div>
        </dl>
        {change && (
          <button
            type="button"
            onClick={() => onReplay(change)}
            className="mt-3 w-full bg-ink px-4 py-2.5 font-display text-[16px] font-semibold uppercase tracking-[0.04em] text-label"
          >
            {t("graph.replay")}: {change.change.old_value} → {change.change.new_value}
            {fact.unit ? ` ${fact.unit}` : ""}
          </button>
        )}
        <h3 className="mb-2 mt-5 font-display text-[16px] font-semibold uppercase tracking-[0.05em]">
          {t("graph.used_in")} {usageCount} {tn("n.sections", usageCount)}
        </h3>
        {usageCount > 0 ? (
          <div className="flex flex-col gap-3">
            {usageByDoc.map(([doc, list]) => (
              <div key={doc}>
                <div className="mb-1 text-[12px] font-semibold text-ink-soft">
                  {docTitleById.get(doc) ?? doc} ({list.length})
                </div>
                <ul className="flex flex-col gap-1.5">
                  {list.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-[14px]">
                      <LocLabel id={s.id} size={12} />
                      <span className="truncate">{s.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[14px] text-ink-soft">{t("graph.not_referenced")}</p>
        )}
      </div>
    </div>
  );
}

export function GraphView({
  canon,
  documents,
  sections,
  changes,
  onReplay,
}: {
  canon: CanonVersion[];
  documents: DocumentInfo[];
  sections: Section[];
  changes: FactChangeRecord[];
  onReplay: (change: FactChangeRecord) => void;
}) {
  const { t, tn } = useT();
  const [version, setVersion] = useState(canon.length);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const current = canon[version - 1] ?? canon[canon.length - 1] ?? null;
  const sectionById = useMemo(
    () => new Map(sections.map((s) => [s.id, s])),
    [sections],
  );
  const rows = useMemo(() => {
    const facts = current?.facts ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return facts;
    return facts.filter((f) =>
      [f.id, f.subject, f.attribute, f.value, f.unit, f.statement, f.category]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [current, query]);
  const selected: Fact | null =
    current?.facts.find((f) => f.id === selectedId) ?? null;
  const selectedChange = selected
    ? (changes.find((c) => c.change.fact_id === selected.id) ?? null)
    : null;
  const selectedUsage = useMemo(
    () =>
      selected
        ? (((current?.usage ?? {})[selected.id] ?? [])
            .map((id) => sectionById.get(id))
            .filter((s): s is Section => s !== undefined))
        : [],
    [selected, current, sectionById],
  );
  const docTitleById = useMemo(
    () => new Map(documents.map((d) => [d.id, d.title])),
    [documents],
  );
  const usageByDoc = useMemo(() => {
    const groups = new Map<string, Section[]>();
    for (const s of selectedUsage) {
      const d = s.doc ?? "ops";
      const list = groups.get(d) ?? [];
      list.push(s);
      groups.set(d, list);
    }
    const order = new Map(documents.map((d, i) => [d.id, i]));
    return [...groups.entries()].sort(
      (a, b) => (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99),
    );
  }, [selectedUsage, documents]);

  if (!current) {
    return <p className="m-6 text-[14px] text-ink-soft">{t("graph.no_versions")}</p>;
  }

  const th =
    "border-b-[1.5px] border-ink px-2 py-2 text-left font-display text-[13px] font-semibold uppercase tracking-[0.06em]";

  return (
    <div className="grid grid-cols-[1fr_360px] max-lg:grid-cols-1">
      <section className="min-w-0 px-6 py-5">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="font-mono text-[15px] font-bold">
            {versionLabel(current.version)}
          </span>
          <span className="text-[14px] text-ink-soft">
            {current.facts.length} {tn("n.facts", current.facts.length)}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="font-mono text-[12px] text-ink-soft">v01</span>
          <input
            type="range"
            min={1}
            max={canon.length}
            step={1}
            value={version}
            onChange={(e) => setVersion(Number(e.target.value))}
            aria-label={t("graph.version")}
            className="h-6 w-full accent-ink"
          />
          <span className="font-mono text-[12px] text-ink-soft">
            {versionLabel(canon.length)}
          </span>
        </div>
        <p className="truncate text-[13px] text-ink-soft" title={current.note}>
          {current.note}
        </p>
        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("graph.search")}
            aria-label={t("graph.search")}
            className="h-10 w-full border-[1.5px] border-ink bg-label pl-9 pr-3 text-[14px] placeholder:text-ink-soft"
          />
        </div>
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>{t("graph.col_fact")}</th>
              <th className={th}>{t("graph.col_subject")}</th>
              <th className={th}>{t("graph.col_value")}</th>
              <th className={`${th} text-right`}>{t("graph.used_in")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const used = current.usage[f.id]?.length ?? 0;
              const active = f.id === selectedId;
              return (
                <tr
                  key={f.id}
                  onClick={() => setSelectedId(f.id)}
                  className={`cursor-pointer border-b border-rule ${active ? "bg-concrete-deep" : "hover:bg-concrete"}`}
                >
                  <td className="px-2 py-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedId(f.id)}
                      aria-current={active ? "true" : undefined}
                      className="font-mono text-[13px] font-semibold underline decoration-rule underline-offset-2 hover:decoration-ink"
                    >
                      {f.id}
                    </button>
                  </td>
                  <td className="max-w-[220px] truncate px-2 py-1.5 font-mono text-[13px] text-ink-soft">
                    {f.subject}.{f.attribute}
                  </td>
                  <td className="max-w-[220px] truncate px-2 py-1.5 text-[13px]">
                    {f.value}
                    {f.unit ? ` ${f.unit}` : ""}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[13px] tabular-nums">
                    {used}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-[14px] text-ink-soft">
                  {t("graph.no_match")} &ldquo;{query}&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <aside className="flex min-h-[420px] border-l-[1.5px] border-ink bg-label max-lg:border-l-0 max-lg:border-t-[1.5px]">
        {selected ? (
          <FactPane
            key={selected.id}
            fact={selected}
            change={selectedChange}
            usageByDoc={usageByDoc}
            usageCount={selectedUsage.length}
            docTitleById={docTitleById}
            onReplay={onReplay}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <p className="m-6 text-[14px] text-ink-soft">{t("graph.select")}</p>
        )}
      </aside>
    </div>
  );
}

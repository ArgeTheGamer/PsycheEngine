"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Contradiction,
  DocumentInfo,
  Fact,
  RunId,
  Section,
} from "@/lib/types";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsList,
  TabsTrigger,
} from "./ui";
import { cn } from "@/lib/utils";

const FACT_RE = /\[(F-[A-Z]+-\d+)\]/g;

type Seg = { text: string; contra?: Contradiction; factId?: string };

function segmentParagraph(
  text: string,
  quotes: { quote: string; c: Contradiction }[],
): Seg[] {
  type M = { start: number; end: number; c?: Contradiction; factId?: string };
  const matches: M[] = [];
  for (const { quote, c } of quotes) {
    let i = text.indexOf(quote);
    while (i !== -1) {
      matches.push({ start: i, end: i + quote.length, c });
      i = text.indexOf(quote, i + 1);
    }
  }
  FACT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(FACT_RE);
  while ((m = re.exec(text)) !== null) {
    const s = m.index;
    const e = s + m[0].length;
    if (!matches.some((x) => s < x.end && e > x.start)) {
      matches.push({ start: s, end: e, factId: m[1] });
    }
  }
  matches.sort((a, b) => a.start - b.start);
  const segs: Seg[] = [];
  let pos = 0;
  for (const mt of matches) {
    if (mt.start < pos) continue;
    if (mt.start > pos) segs.push({ text: text.slice(pos, mt.start) });
    segs.push({
      text: text.slice(mt.start, mt.end),
      contra: mt.c,
      factId: mt.factId,
    });
    pos = mt.end;
  }
  if (pos < text.length) segs.push({ text: text.slice(pos) });
  return segs;
}

function FactRef({
  factId,
  fact,
  hovered,
  onHover,
}: {
  factId: string;
  fact: Fact | undefined;
  hovered: boolean;
  onHover: (id: string | null) => void;
}) {
  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => onHover(factId)}
      onMouseLeave={() => onHover(null)}
    >
      <span
        className={cn(
          "cursor-default rounded border px-1 font-mono text-[11px] whitespace-nowrap",
          hovered
            ? "border-emerald-300 bg-emerald-500/30 text-emerald-200"
            : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300/90",
        )}
      >
        {factId}
      </span>
      {hovered && fact && (
        <span className="absolute bottom-full left-0 z-30 mb-1.5 w-64 rounded-md border border-zinc-700 bg-zinc-950 p-2 text-xs font-normal whitespace-normal text-zinc-200 shadow-xl">
          <span className="font-mono text-emerald-300">{fact.id}</span>{" "}
          <span className="text-zinc-400">
            {fact.value}
            {fact.unit ? ` ${fact.unit}` : ""}
          </span>
          <br />
          {fact.statement}
        </span>
      )}
    </span>
  );
}

function SectionText({
  section,
  contradictions,
  factById,
}: {
  section: Section;
  contradictions: Contradiction[];
  factById: Map<string, Fact>;
}) {
  const [hoveredFact, setHoveredFact] = useState<string | null>(null);
  const quotes = useMemo(
    () =>
      contradictions.flatMap((c) => {
        const out: { quote: string; c: Contradiction }[] = [];
        if (c.section_a === section.id)
          out.push({ quote: c.quote_a, c });
        if (c.section_b === section.id)
          out.push({ quote: c.quote_b, c });
        return out;
      }),
    [contradictions, section.id],
  );
  const paragraphs = useMemo(() => section.text.split("\n\n"), [section.text]);

  return (
    <div className="flex flex-col gap-3 text-[13px] leading-relaxed text-zinc-300">
      {paragraphs.map((p, i) => (
        <p key={i}>
          {segmentParagraph(p, quotes).map((seg, j) => {
            if (seg.contra) {
              return (
                <span
                  key={j}
                  className="rounded bg-rose-500/25 px-0.5 text-rose-200"
                  title={`${seg.contra.id}: ${seg.contra.explanation}`}
                >
                  {seg.text}
                </span>
              );
            }
            if (seg.factId) {
              return (
                <FactRef
                  key={j}
                  factId={seg.factId}
                  fact={factById.get(seg.factId)}
                  hovered={hoveredFact === seg.factId}
                  onHover={setHoveredFact}
                />
              );
            }
            return <span key={j}>{seg.text}</span>;
          })}
        </p>
      ))}
    </div>
  );
}

export type DocFocus = {
  run: RunId;
  doc: string;
  sectionId: string;
};

export function DocPanel({
  documents,
  sectionsPsyche,
  sectionsBaseline,
  contradictionsPsyche,
  contradictionsBaseline,
  canonFacts,
  focus,
}: {
  documents: DocumentInfo[];
  sectionsPsyche: Section[];
  sectionsBaseline: Section[];
  contradictionsPsyche: Contradiction[];
  contradictionsBaseline: Contradiction[];
  canonFacts: Fact[];
  focus: DocFocus | null;
}) {
  const [tab, setTab] = useState<RunId>("psyche");
  const [docId, setDocId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (focus) {
      setTab(focus.run);
      setDocId(focus.doc);
      setSelectedId(focus.sectionId);
    }
  }, [focus]);

  const sections = tab === "psyche" ? sectionsPsyche : sectionsBaseline;
  const contradictions =
    tab === "psyche" ? contradictionsPsyche : contradictionsBaseline;
  const docTitleById = useMemo(
    () => new Map(documents.map((d) => [d.id, d.title])),
    [documents],
  );
  // Older runs lack Section.doc — treat those sections as "ops".
  const docOf = (s: Section) => s.doc ?? "ops";
  const doc = docId ?? documents[0]?.id ?? "ops";
  const docSections = sections.filter((s) => docOf(s) === doc);
  const section =
    docSections.find((s) => s.id === selectedId) ?? docSections[0] ?? null;
  const factById = useMemo(
    () => new Map(canonFacts.map((f) => [f.id, f])),
    [canonFacts],
  );
  const sectionById = useMemo(
    () => new Map(sections.map((s) => [s.id, s])),
    [sections],
  );
  const groups = useMemo(() => {
    const byChapter = new Map<number, Section[]>();
    for (const s of [...docSections].sort((a, b) => a.id.localeCompare(b.id))) {
      const list = byChapter.get(s.chapter) ?? [];
      list.push(s);
      byChapter.set(s.chapter, list);
    }
    return [...byChapter.entries()].sort((a, b) => a[0] - b[0]);
  }, [docSections]);
  const sectionsWithContra = useMemo(
    () =>
      new Set(contradictions.flatMap((c) => [c.section_a, c.section_b])),
    [contradictions],
  );
  const sectionContras = section
    ? contradictions.filter(
        (c) => c.section_a === section.id || c.section_b === section.id,
      )
    : [];

  function switchTab(v: RunId) {
    const nextSections = v === "psyche" ? sectionsPsyche : sectionsBaseline;
    const chapter = section?.chapter;
    const inChapter =
      chapter !== undefined
        ? nextSections.find(
            (s) => (s.doc ?? "ops") === doc && s.chapter === chapter,
          )
        : undefined;
    const next =
      inChapter ??
      nextSections.find((s) => (s.doc ?? "ops") === doc) ??
      nextSections[0] ??
      null;
    setTab(v);
    setSelectedId(next?.id ?? null);
  }

  function switchDoc(d: string) {
    const next = sections.find((s) => docOf(s) === d) ?? null;
    setDocId(d);
    setSelectedId(next?.id ?? null);
  }

  return (
    <Card className="min-h-[440px] xl:h-[calc((100vh-112px)/2)] xl:min-h-[400px]">
      <CardHeader>
        <CardTitle>Document</CardTitle>
        <Tabs
          value={tab}
          onValueChange={(v) => switchTab(v as RunId)}
          className="ml-auto"
        >
          <TabsList>
            <TabsTrigger value="psyche">
              PsycheEngine
              <Badge variant="default">{contradictionsPsyche.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="baseline">
              Baseline
              <Badge variant="danger">{contradictionsBaseline.length}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 gap-2">
        <div className="flex gap-1 rounded-md bg-zinc-800/70 p-1">
          {documents.map((d) => (
            <button
              key={d.id}
              onClick={() => switchDoc(d.id)}
              title={d.title}
              className={cn(
                "min-w-0 flex-1 truncate rounded px-2 py-1 text-xs font-medium outline-none",
                d.id === doc
                  ? "bg-zinc-950 text-zinc-100 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200",
              )}
            >
              {d.title}
            </button>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-row gap-3">
        <div className="flex w-44 shrink-0 flex-col gap-1 overflow-auto pr-1">
          {groups.map(([chapter, list]) => (
            <div key={chapter}>
              <div className="px-2 pt-1 pb-0.5 text-xs font-semibold text-zinc-300">
                {chapter}. {list[0]?.chapter_title ?? ""}
              </div>
              {list.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={cn(
                    "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 pl-4 text-left text-xs outline-none",
                    s.id === section?.id
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200",
                  )}
                >
                  <span className="truncate">{s.title}</span>
                  {sectionsWithContra.has(s.id) && (
                    <span className="ml-auto size-1.5 shrink-0 rounded-full bg-rose-400" />
                  )}
                </button>
              ))}
            </div>
          ))}
          {groups.length === 0 && (
            <p className="px-2 py-4 text-xs text-zinc-500">
              No sections in this run.
            </p>
          )}
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-auto rounded-md border border-zinc-800 p-3">
          {!section && (
            <p className="text-xs text-zinc-500">No sections in this run.</p>
          )}
          {section && (
            <>
              <div className="mb-1 text-xs text-zinc-500">
                Ch {section.chapter} · {section.chapter_title}
              </div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                {section.title}
                {section.attempts > 1 && (
                  <Badge variant="warn">rewritten {section.attempts}×</Badge>
                )}
              </h3>
              <SectionText
                section={section}
                contradictions={contradictions}
                factById={factById}
              />
              {sectionContras.length > 0 && (
                <div className="mt-3 flex flex-col gap-2 border-t border-zinc-800 pt-2">
                  {sectionContras.map((c) => {
                    const otherId =
                      c.section_a === section.id ? c.section_b : c.section_a;
                    const other = sectionById.get(otherId);
                    const otherDoc = other ? docOf(other) : null;
                    const crossDoc = otherDoc !== null && otherDoc !== doc;
                    return (
                      <div
                        key={c.id}
                        className="rounded-md border border-rose-500/30 bg-rose-500/5 p-2 text-xs"
                      >
                        <div className="mb-1 flex items-center gap-1.5">
                          <Badge variant="danger">{c.id}</Badge>
                          <Badge variant="outline">{c.category}</Badge>
                          {crossDoc && <Badge variant="warn">cross-doc</Badge>}
                        </div>
                        <p className="text-zinc-300">{c.explanation}</p>
                        {other && (
                          <button
                            onClick={() => {
                              setDocId(otherDoc);
                              setSelectedId(other.id);
                            }}
                            className="mt-1 text-left text-rose-300 underline decoration-rose-400/50 underline-offset-2 hover:text-rose-200"
                          >
                            {crossDoc
                              ? `conflicts with ${docTitleById.get(otherDoc ?? "") ?? otherDoc} › ${other.title}`
                              : `see also ${other.title}`}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
        </div>
      </CardContent>
    </Card>
  );
}

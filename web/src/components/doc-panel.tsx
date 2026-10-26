"use client";

import { useMemo, useState } from "react";
import type {
  Contradiction,
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
  TabsContent,
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

export function DocPanel({
  sectionsPsyche,
  sectionsBaseline,
  contradictionsPsyche,
  contradictionsBaseline,
  canonFacts,
}: {
  sectionsPsyche: Section[];
  sectionsBaseline: Section[];
  contradictionsPsyche: Contradiction[];
  contradictionsBaseline: Contradiction[];
  canonFacts: Fact[];
}) {
  const [tab, setTab] = useState<RunId>("psyche");
  const [chapter, setChapter] = useState(1);

  const sections = tab === "psyche" ? sectionsPsyche : sectionsBaseline;
  const contradictions =
    tab === "psyche" ? contradictionsPsyche : contradictionsBaseline;
  const section = sections.find((s) => s.chapter === chapter) ?? sections[0];
  const factById = useMemo(
    () => new Map(canonFacts.map((f) => [f.id, f])),
    [canonFacts],
  );
  const chaptersWithContra = useMemo(() => {
    const ids = new Set(
      contradictions.flatMap((c) => [c.section_a, c.section_b]),
    );
    return new Set(
      sections.filter((s) => ids.has(s.id)).map((s) => s.chapter),
    );
  }, [contradictions, sections]);
  const chapterContras = section
    ? contradictions.filter(
        (c) => c.section_a === section.id || c.section_b === section.id,
      )
    : [];

  return (
    <Card className="min-h-[440px] xl:h-[calc((100vh-112px)/2)] xl:min-h-[400px]">
      <CardHeader>
        <CardTitle>Document</CardTitle>
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as RunId)}
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
      <CardContent className="min-h-0 flex-1 flex-row gap-3">
        <div className="flex w-40 shrink-0 flex-col gap-0.5 overflow-auto pr-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setChapter(s.chapter)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs outline-none",
                s.chapter === chapter
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200",
              )}
            >
              <span className="font-mono text-[11px] text-zinc-500">
                {String(s.chapter).padStart(2, "0")}
              </span>
              <span className="truncate">{s.title}</span>
              {chaptersWithContra.has(s.chapter) && (
                <span className="ml-auto size-1.5 shrink-0 rounded-full bg-rose-400" />
              )}
            </button>
          ))}
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-auto rounded-md border border-zinc-800 p-3">
          {section && (
            <>
              <h3 className="mb-2 text-sm font-semibold">
                <span className="mr-2 font-mono text-xs text-zinc-500">
                  Ch {section.chapter}
                </span>
                {section.title}
              </h3>
              <SectionText
                section={section}
                contradictions={contradictions}
                factById={factById}
              />
              {chapterContras.length > 0 && (
                <div className="mt-3 flex flex-col gap-2 border-t border-zinc-800 pt-2">
                  {chapterContras.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-md border border-rose-500/30 bg-rose-500/5 p-2 text-xs"
                    >
                      <div className="mb-1 flex items-center gap-1.5">
                        <Badge variant="danger">{c.id}</Badge>
                        <Badge variant="outline">{c.category}</Badge>
                      </div>
                      <p className="text-zinc-300">{c.explanation}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

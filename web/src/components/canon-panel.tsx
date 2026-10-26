"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { CanonVersion, Fact, Section } from "@/lib/types";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Slider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui";

function versionLabel(v: number) {
  return `v${String(v).padStart(2, "0")}`;
}

export function CanonPanel({
  canon,
  sections,
}: {
  canon: CanonVersion[];
  sections: Section[];
}) {
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
  const selectedUsage = selected
    ? ((current?.usage ?? {})[selected.id] ?? [])
        .map((id) => sectionById.get(id))
        .filter((s): s is Section => s !== undefined)
    : [];

  if (!current) {
    return (
      <Card className="min-h-[440px] xl:h-[calc((100vh-112px)/2)] xl:min-h-[400px]">
        <CardHeader>
          <CardTitle>Canon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-zinc-500">
            No canon versions in this run.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="min-h-[440px] xl:h-[calc((100vh-112px)/2)] xl:min-h-[400px]">
      <CardHeader>
        <CardTitle>Canon</CardTitle>
        <Badge variant="secondary">{current.facts.length} facts</Badge>
        <span className="ml-auto font-mono text-xs text-emerald-300">
          {versionLabel(current.version)}
        </span>
      </CardHeader>
      <CardContent className="gap-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-zinc-500">v01</span>
          <Slider
            min={1}
            max={canon.length}
            step={1}
            value={[version]}
            onValueChange={(v) => setVersion(v[0] ?? canon.length)}
            aria-label="Canon version"
          />
          <span className="font-mono text-[11px] text-zinc-500">
            {versionLabel(canon.length)}
          </span>
        </div>
        <p className="truncate text-xs text-zinc-400" title={current.note}>
          {current.note}
        </p>
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search facts…"
            className="pl-8"
            aria-label="Search facts"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-zinc-800">
          <Table>
            <TableHeader className="sticky top-0 bg-zinc-900">
              <TableRow>
                <TableHead>Fact</TableHead>
                <TableHead>Subject.attribute</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="text-right">Used in</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((f) => {
                const used = current.usage[f.id]?.length ?? 0;
                return (
                  <TableRow
                    key={f.id}
                    className="cursor-pointer hover:bg-zinc-800/60"
                    onClick={() => setSelectedId(f.id)}
                  >
                    <TableCell className="font-mono text-xs whitespace-nowrap text-zinc-300">
                      {f.id}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate font-mono text-xs text-zinc-400">
                      {f.subject}.{f.attribute}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">
                      {f.value}
                      {f.unit ? ` ${f.unit}` : ""}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="whitespace-nowrap">
                        {used} {used === 1 ? "section" : "sections"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-6 text-center text-xs text-zinc-500"
                  >
                    No facts match “{query}”.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent>
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.id}</SheetTitle>
                <div className="flex flex-wrap gap-1.5">
                  <Badge>{selected.category}</Badge>
                  <Badge variant="secondary">{selected.source}</Badge>
                </div>
              </SheetHeader>
              <p className="text-sm leading-relaxed text-zinc-200">
                {selected.statement}
              </p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-zinc-800 p-3 text-xs">
                <div>
                  <dt className="text-zinc-500">Subject</dt>
                  <dd className="font-mono">{selected.subject}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Attribute</dt>
                  <dd className="font-mono">{selected.attribute}</dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Value</dt>
                  <dd className="font-mono">
                    {selected.value}
                    {selected.unit ? ` ${selected.unit}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500">Source</dt>
                  <dd>{selected.source}</dd>
                </div>
              </dl>
              <div>
                <h3 className="mb-1.5 text-xs font-semibold text-zinc-300">
                  Used in {selectedUsage.length}{" "}
                  {selectedUsage.length === 1 ? "section" : "sections"}
                </h3>
                {selectedUsage.length > 0 ? (
                  <ul className="flex flex-col gap-1 overflow-auto">
                    {selectedUsage.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center gap-2 rounded-md border border-zinc-800 px-2 py-1.5 text-xs"
                      >
                        <Badge variant="outline">Ch {s.chapter}</Badge>
                        <span className="truncate">{s.title}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-zinc-500">
                    Not referenced by any section yet.
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}

"use client";

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { DocumentInfo, Section } from "@/lib/types";
import { useT } from "@/lib/i18n";

const COLS = 2;
const GROUP_W = 240;
const COL_PITCH = 258;
const ROW_GAP = 26;
const DOC_HEADER_H = 36;
const CH_HEADER_H = 22;
const CHILD_H = 28;
const CHILD_GAP = 5;
const PAD = 10;

export function ChangeGraph({
  factId,
  factLabel,
  affected,
  sections,
  documents,
}: {
  factId: string;
  factLabel: string;
  affected: string[];
  sections: Section[];
  documents: DocumentInfo[];
}) {
  const { t, tn } = useT();
  const { nodes, edges, affectedDocs } = useMemo(() => {
    const affectedSet = new Set(affected);
    const docTitle = new Map(documents.map((d) => [d.id, d.title]));
    const byDoc = new Map<string, Map<number, Section[]>>();
    for (const s of [...sections].sort((a, b) => a.id.localeCompare(b.id))) {
      const d = s.doc ?? "ops";
      if (!byDoc.has(d)) byDoc.set(d, new Map());
      const chapters = byDoc.get(d) as Map<number, Section[]>;
      const list = chapters.get(s.chapter) ?? [];
      list.push(s);
      chapters.set(s.chapter, list);
    }
    const order = new Map(documents.map((d, i) => [d.id, i]));
    const docs = [...byDoc.entries()].sort(
      (a, b) => (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99),
    );

    // Measure each doc box first so row heights fit the tallest box.
    const heights = docs.map(([, chapters]) => {
      let h = DOC_HEADER_H + PAD;
      for (const [, list] of [...chapters.entries()].sort(
        (a, b) => a[0] - b[0],
      )) {
        h += CH_HEADER_H + 4 + list.length * (CHILD_H + CHILD_GAP) + 8;
      }
      return h;
    });
    const rowY: number[] = [];
    let y = 0;
    for (let r = 0; r * COLS < docs.length; r++) {
      rowY.push(y);
      const rowHeights = heights.slice(r * COLS, r * COLS + COLS);
      y += Math.max(...rowHeights) + ROW_GAP;
    }
    const gridH = y - ROW_GAP;

    const nodes: Node[] = [
      {
        id: "__fact__",
        position: { x: -268, y: gridH / 2 - 34 },
        data: {
          label: (
            <div>
              <div className="font-mono text-[13px] font-bold text-label">
                {factId}
              </div>
              <div className="truncate font-mono text-[10px] text-concrete-deep">
                {factLabel}
              </div>
            </div>
          ),
        },
        style: {
          background: "var(--color-ink)",
          border: "1.5px solid var(--color-ink)",
          borderRadius: 0,
          width: 200,
          padding: 8,
        },
      },
    ];

    docs.forEach((([docId, chapters], i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const gx = col * COL_PITCH;
      const gy = rowY[row] ?? 0;
      const groupId = `__doc-${docId}__`;
      nodes.push({
        id: groupId,
        position: { x: gx, y: gy },
        data: {
          label: (
            <div className="px-1 pt-1 text-left text-[12px] font-semibold">
              {docTitle.get(docId) ?? docId}
            </div>
          ),
        },
        style: {
          background: "var(--color-label)",
          border: "1.5px solid var(--color-ink)",
          borderRadius: 0,
          width: GROUP_W,
          height: heights[i],
        },
      });
      let cy = DOC_HEADER_H;
      for (const [chapter, list] of [...chapters.entries()].sort(
        (a, b) => a[0] - b[0],
      )) {
        nodes.push({
          id: `${groupId}-ch${chapter}`,
          parentId: groupId,
          extent: "parent",
          position: { x: PAD, y: cy },
          data: {
            label: (
              <div className="truncate text-left text-[10px] font-medium text-ink-soft">
                {chapter}. {list[0]?.chapter_title ?? ""}
              </div>
            ),
          },
          style: {
            background: "transparent",
            border: "none",
            width: GROUP_W - PAD * 2,
            height: CH_HEADER_H,
          },
        });
        cy += CH_HEADER_H + 4;
        for (const s of list) {
          const hit = affectedSet.has(s.id);
          nodes.push({
            id: s.id,
            parentId: groupId,
            extent: "parent",
            position: { x: PAD, y: cy },
            data: {
              label: (
                <div className="truncate text-left">
                  <span
                    className={`font-mono text-[10px] ${hit ? "font-bold text-label" : ""}`}
                  >
                    {s.id}
                  </span>{" "}
                  <span
                    className={`text-[10px] ${hit ? "text-concrete-deep" : "text-ink-soft"}`}
                  >
                    {s.title}
                  </span>
                </div>
              ),
            },
            style: {
              background: hit ? "var(--color-ink)" : "var(--color-concrete)",
              border: hit
                ? "1px solid var(--color-ink)"
                : "1px solid var(--color-rule)",
              borderRadius: 0,
              width: GROUP_W - PAD * 2,
              height: CHILD_H,
              padding: "2px 6px",
              opacity: hit ? 1 : 0.55,
            },
          });
          cy += CHILD_H + CHILD_GAP;
        }
        cy += 8;
      }
    }));

    const edges: Edge[] = affected
      .filter((id) => sections.some((s) => s.id === id))
      .map((id) => ({
        id: `e-${id}`,
        source: "__fact__",
        target: id,
        animated: true,
        style: { stroke: "var(--color-ink)", strokeWidth: 1.5 },
      }));
    const affectedDocs = new Set(
      affected.map((id) => sections.find((s) => s.id === id)?.doc ?? "ops"),
    );
    return { nodes, edges, affectedDocs: affectedDocs.size };
  }, [factId, factLabel, affected, sections, documents]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="min-h-0 flex-1 overflow-hidden border border-rule bg-concrete">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          zoomOnScroll={false}
          panOnDrag={false}
          proOptions={{ hideAttribution: false }}
          colorMode="light"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        </ReactFlow>
      </div>
      <p className="text-center text-[17px]">
        <span className="font-mono font-bold">{affected.length}</span>{" "}
        {tn("n.sections", affected.length)} {t("replay.in")}{" "}
        <span className="font-mono font-bold">{affectedDocs}</span>{" "}
        {tn("n.documents_loc", affectedDocs)} {t("replay.depend_on")}{" "}
        <span className="font-mono font-bold">{factId}</span>
      </p>
    </div>
  );
}

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
import type { Section } from "@/lib/types";

const COLS = 5;
const COL_W = 196;
const ROW_H = 184;
const GROUP_W = 182;
const CHILD_H = 30;
const CHILD_GAP = 6;
const HEADER_H = 34;

function shortId(id: string): string {
  return id.replace(/^(psy|base)-/, "");
}

export function ChangeGraph({
  factId,
  factLabel,
  affected,
  sections,
}: {
  factId: string;
  factLabel: string;
  affected: string[];
  sections: Section[];
}) {
  const { nodes, edges } = useMemo(() => {
    const affectedSet = new Set(affected);
    const byChapter = new Map<number, Section[]>();
    for (const s of [...sections].sort((a, b) => a.id.localeCompare(b.id))) {
      const list = byChapter.get(s.chapter) ?? [];
      list.push(s);
      byChapter.set(s.chapter, list);
    }
    const chapters = [...byChapter.entries()].sort((a, b) => a[0] - b[0]);

    const nodes: Node[] = [];
    const gridH = Math.ceil(chapters.length / COLS) * ROW_H;
    nodes.push({
      id: "__fact__",
      position: { x: -248, y: gridH / 2 - 34 },
      data: {
        label: (
          <div>
            <div className="font-mono text-[13px] font-bold text-emerald-300">
              {factId}
            </div>
            <div className="truncate font-mono text-[10px] text-zinc-400">
              {factLabel}
            </div>
          </div>
        ),
      },
      style: {
        background: "#064e3b",
        border: "2px solid #34d399",
        borderRadius: 8,
        width: 200,
        padding: 8,
        boxShadow: "0 0 24px rgba(52, 211, 153, 0.35)",
      },
    });

    chapters.forEach(([chapter, list], i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = col * COL_W;
      const y = row * ROW_H;
      const groupId = `__ch${chapter}__`;
      nodes.push({
        id: groupId,
        position: { x, y },
        data: {
          label: (
            <div className="px-1 pt-1 text-left text-[11px] font-semibold text-zinc-300">
              {chapter}. {list[0]?.chapter_title ?? ""}
            </div>
          ),
        },
        style: {
          background: "rgba(24, 24, 27, 0.6)",
          border: "1px solid #3f3f46",
          borderRadius: 8,
          width: GROUP_W,
          height: HEADER_H + list.length * (CHILD_H + CHILD_GAP) + 8,
        },
      });
      list.forEach((s, j) => {
        const hit = affectedSet.has(s.id);
        nodes.push({
          id: s.id,
          parentId: groupId,
          extent: "parent",
          position: { x: 8, y: HEADER_H + j * (CHILD_H + CHILD_GAP) },
          data: {
            label: (
              <div className="truncate text-left">
                <span className="font-mono text-[10px] text-zinc-200">
                  {shortId(s.id)}
                </span>{" "}
                <span className="text-[10px] text-zinc-500">{s.title}</span>
              </div>
            ),
          },
          style: {
            background: hit ? "#064e3b" : "#18181b",
            border: hit ? "1px solid #34d399" : "1px solid #3f3f46",
            borderRadius: 5,
            width: GROUP_W - 16,
            height: CHILD_H,
            padding: "2px 6px",
            opacity: hit ? 1 : 0.35,
            boxShadow: hit
              ? "0 0 14px rgba(52, 211, 153, 0.45)"
              : undefined,
          },
        });
      });
    });

    const edges: Edge[] = affected
      .filter((id) => sections.some((s) => s.id === id))
      .map((id) => ({
        id: `e-${id}`,
        source: "__fact__",
        target: id,
        animated: true,
        style: { stroke: "#34d399", strokeWidth: 1.5 },
      }));
    return { nodes, edges };
  }, [factId, factLabel, affected, sections]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-800">
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
          colorMode="dark"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        </ReactFlow>
      </div>
      <p className="text-center text-lg text-zinc-200">
        <span className="font-mono font-bold text-emerald-300">
          {affected.length}
        </span>{" "}
        of <span className="font-mono">{sections.length}</span> sections depend
        on <span className="font-mono text-emerald-300">{factId}</span>
      </p>
    </div>
  );
}

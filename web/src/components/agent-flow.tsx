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
import { useT } from "@/lib/i18n";

const AGENTS = [
  { id: "planner", model: "muse-spark-1.3", x: 0, y: 40 },
  { id: "writer", model: "muse-spark-1.3", x: 170, y: 40 },
  { id: "critic", model: "Muse Spark Open", x: 340, y: 40 },
  { id: "canon_editor", model: "muse-spark-1.3", x: 170, y: -50 },
];

export function AgentFlow() {
  const { t } = useT();
  const nodes: Node[] = useMemo(
    () =>
      AGENTS.map((a) => ({
        id: a.id,
        position: { x: a.x, y: a.y },
        data: {
          label: (
            <div>
              <div className="font-mono text-[11px] font-semibold">{a.id}</div>
              <div className="font-mono text-[9px] text-ink-soft">{a.model}</div>
            </div>
          ),
        },
        style: {
          background: "var(--color-label)",
          border: "1.5px solid var(--color-ink)",
          borderRadius: 0,
          color: "var(--color-ink)",
          width: 130,
          padding: 4,
        },
      })),
    [],
  );
  const edges: Edge[] = useMemo(
    () => [
      { id: "plan", source: "planner", target: "writer", style: { stroke: "var(--color-rule)" } },
      { id: "draft", source: "writer", target: "critic", style: { stroke: "var(--color-rule)" } },
      {
        id: "rewrite",
        source: "critic",
        target: "writer",
        label: t("logs.rewrite"),
        animated: true,
        style: { stroke: "var(--color-hazard)", strokeDasharray: "4 3" },
        labelStyle: { fill: "var(--color-hazard)", fontSize: 9 },
      },
      {
        id: "slice",
        source: "canon_editor",
        target: "writer",
        label: t("logs.canon_slice"),
        style: { stroke: "var(--color-rule)" },
        labelStyle: { fill: "var(--color-ink-soft)", fontSize: 9 },
      },
    ],
    [t],
  );

  return (
    <div className="h-40 shrink-0 overflow-hidden border-b-[1.5px] border-ink bg-concrete">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        panOnDrag={false}
        proOptions={{ hideAttribution: false }}
        colorMode="light"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}

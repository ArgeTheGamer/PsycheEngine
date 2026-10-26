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

const AGENTS = [
  { id: "planner", model: "muse-spark-1.3", color: "#38bdf8", x: 0, y: 40 },
  { id: "writer", model: "muse-spark-1.3", color: "#34d399", x: 170, y: 40 },
  { id: "critic", model: "Muse Spark Open", color: "#fbbf24", x: 340, y: 40 },
  { id: "canon_editor", model: "muse-spark-1.3", color: "#a1a1aa", x: 170, y: -50 },
];

export function AgentFlow() {
  const nodes: Node[] = useMemo(
    () =>
      AGENTS.map((a) => ({
        id: a.id,
        position: { x: a.x, y: a.y },
        data: {
          label: (
            <div>
              <div className="font-mono text-[11px] font-semibold">{a.id}</div>
              <div className="font-mono text-[9px] text-zinc-500">{a.model}</div>
            </div>
          ),
        },
        style: {
          background: "#18181b",
          border: "1px solid #3f3f46",
          borderTop: `2px solid ${a.color}`,
          borderRadius: 6,
          color: "#e4e4e7",
          width: 130,
          padding: 4,
        },
      })),
    [],
  );
  const edges: Edge[] = useMemo(
    () => [
      { id: "plan", source: "planner", target: "writer", style: { stroke: "#52525b" } },
      { id: "draft", source: "writer", target: "critic", style: { stroke: "#52525b" } },
      {
        id: "rewrite",
        source: "critic",
        target: "writer",
        label: "rewrite",
        animated: true,
        style: { stroke: "#fbbf24", strokeDasharray: "4 3" },
        labelStyle: { fill: "#fbbf24", fontSize: 9 },
      },
      {
        id: "slice",
        source: "canon_editor",
        target: "writer",
        label: "canon slice",
        style: { stroke: "#52525b" },
        labelStyle: { fill: "#a1a1aa", fontSize: 9 },
      },
    ],
    [],
  );

  return (
    <div className="h-36 shrink-0 overflow-hidden rounded-md border border-zinc-800">
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
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}

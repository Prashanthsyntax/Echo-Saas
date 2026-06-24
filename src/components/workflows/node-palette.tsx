"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  TRIGGER_NODES,
  ACTION_NODES,
  CONDITION_NODES,
  type WorkflowNodeData,
} from "./workflow-types";

type PaletteTab = "triggers" | "actions" | "conditions";

const tabs: { id: PaletteTab; label: string }[] = [
  { id: "triggers", label: "Triggers" },
  { id: "actions", label: "Actions" },
  { id: "conditions", label: "Conditions" },
];

const paletteData = {
  triggers: TRIGGER_NODES,
  actions: ACTION_NODES,
  conditions: CONDITION_NODES,
};

const tabColors: Record<PaletteTab, string> = {
  triggers: "text-violet-400",
  actions: "text-sky-400",
  conditions: "text-amber-400",
};

export function NodePalette() {
  const [activeTab, setActiveTab] = useState<PaletteTab>("triggers");

  const onDragStart = (
    e: React.DragEvent,
    nodeData: Omit<WorkflowNodeData, "configured" | "config">
  ) => {
    e.dataTransfer.setData(
      "application/reactflow",
      JSON.stringify({ ...nodeData, configured: false })
    );
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-card/50">
      <div className="border-b border-border px-4 py-4">
        <h2 className="text-sm font-medium">Node library</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Drag nodes onto the canvas
        </p>
      </div>

      {/* tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 py-2 text-xs font-medium transition-colors",
              activeTab === tab.id
                ? cn("border-b-2 border-primary", tabColors[tab.id])
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* node list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {paletteData[activeTab].map((node) => (
          <div
            key={node.label}
            draggable
            onDragStart={(e) => onDragStart(e, node)}
            className="group flex cursor-grab items-center gap-3 rounded-lg border border-border bg-background p-3 transition-all hover:border-primary/40 hover:bg-primary/5 active:cursor-grabbing"
          >
            <span className="text-xl leading-none">{node.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{node.label}</p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {node.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
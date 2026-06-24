"use client";

import { memo, useState } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { Settings, CheckCircle2, AlertCircle, X } from "lucide-react";
import type { WorkflowNodeData } from "./workflow-types";

const nodeTypeStyles: Record<string, string> = {
  trigger:
    "border-violet-500/40 bg-violet-500/10 hover:border-violet-500/60",
  action:
    "border-sky-500/40 bg-sky-500/10 hover:border-sky-500/60",
  condition:
    "border-amber-500/40 bg-amber-500/10 hover:border-amber-500/60",
  output:
    "border-emerald-500/40 bg-emerald-500/10 hover:border-emerald-500/60",
};

const nodeTypeBadge: Record<string, string> = {
  trigger: "bg-violet-500/20 text-violet-300",
  action: "bg-sky-500/20 text-sky-300",
  condition: "bg-amber-500/20 text-amber-300",
  output: "bg-emerald-500/20 text-emerald-300",
};

export const WorkflowNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as WorkflowNodeData;
  const [showConfig, setShowConfig] = useState(false);

  return (
    <div
      className={cn(
        "relative w-64 rounded-xl border-2 bg-card p-4 shadow-lg transition-all duration-150",
        nodeTypeStyles[nodeData.nodeType] ?? "border-border",
        selected && "ring-2 ring-primary ring-offset-1 ring-offset-background"
      )}
    >
      {/* top handle (for non-triggers) */}
      {nodeData.nodeType !== "trigger" && (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-3 !w-3 !border-2 !border-background !bg-primary"
        />
      )}

      {/* node header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none">{nodeData.icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">{nodeData.label}</p>
            <span
              className={cn(
                "mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                nodeTypeBadge[nodeData.nodeType]
              )}
            >
              {nodeData.nodeType}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {nodeData.configured ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-amber-400" />
          )}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {showConfig ? (
              <X className="h-3.5 w-3.5" />
            ) : (
              <Settings className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* description */}
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {nodeData.description}
      </p>

      {/* inline config panel */}
      {showConfig && (
        <div className="mt-3 space-y-2 rounded-lg border border-border bg-background/50 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Configuration
          </p>
          {nodeData.nodeType === "action" &&
            nodeData.label === "Send Email" && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  To address
                </label>
                <input
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="you@example.com"
                  defaultValue={nodeData.config?.to ?? ""}
                />
              </div>
            )}
          {nodeData.nodeType === "trigger" &&
            nodeData.label === "Schedule" && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">
                  Interval
                </label>
                <select className="w-full rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                  <option>Every hour</option>
                  <option>Every day</option>
                  <option>Every week</option>
                </select>
              </div>
            )}
          {!["Send Email", "Schedule"].includes(nodeData.label) && (
            <p className="text-xs text-muted-foreground">
              This node runs automatically with default settings.
            </p>
          )}
        </div>
      )}

      {/* bottom handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-3 !w-3 !border-2 !border-background !bg-primary"
      />
    </div>
  );
});

WorkflowNode.displayName = "WorkflowNode";
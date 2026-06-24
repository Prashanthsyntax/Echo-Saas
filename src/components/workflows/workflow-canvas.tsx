/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type OnConnect,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { WorkflowNode } from "./workflow-node";
import { NodePalette } from "./node-palette";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  WORKFLOW_TEMPLATES,
  type WorkflowTemplate,
  type WorkflowNodeData,
} from "./workflow-types";
import { Play, Save, Trash2, LayoutTemplate, X } from "lucide-react";
import { cn } from "@/lib/utils";

const nodeTypes = { workflowNode: WorkflowNode };

let nodeId = 10;
const getNodeId = () => `node_${nodeId++}`;

export function WorkflowCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [workflowName, setWorkflowName] = useState("Untitled workflow");
  const [isRunning, setIsRunning] = useState(false);
  const [runLog, setRunLog] = useState<string[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [saved, setSaved] = useState(false);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const onConnect: OnConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge({ ...params, type: "smoothstep", animated: true }, eds),
      ),
    [setEdges],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      const raw = e.dataTransfer.getData("application/reactflow");
      if (!raw) return;

      const nodeData = JSON.parse(raw);
      const position = reactFlowInstance?.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      if (!position) return;

      const newNode: Node = {
        id: getNodeId(),
        type: "workflowNode",
        position,
        data: nodeData,
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [reactFlowInstance, setNodes],
  );

  const handleSave = () => {
    const workflow = { name: workflowName, nodes, edges };
    localStorage.setItem(`workflow_${Date.now()}`, JSON.stringify(workflow));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleRun = async () => {
    if (nodes.length === 0) return;
    setIsRunning(true);
    setRunLog([]);

    const triggerNodes = nodes.filter(
      (n) => (n.data as any).nodeType === "trigger",
    );
    const actionNodes = nodes.filter(
      (n) => (n.data as any).nodeType !== "trigger",
    );

    setRunLog([`▶ Starting workflow: ${workflowName}`]);
    await delay(500);

    for (const node of triggerNodes) {
      setRunLog((prev) => [...prev, `🔵 Trigger: ${(node.data as any).label}`]);
      await delay(600);
    }

    for (const node of actionNodes) {
      setRunLog((prev) => [
        ...prev,
        `⚡ Running: ${(node.data as any).label}...`,
      ]);
      await delay(800);
      setRunLog((prev) => [
        ...prev,
        `✅ Completed: ${(node.data as any).label}`,
      ]);
      await delay(300);
    }

    setRunLog((prev) => [...prev, `✨ Workflow completed successfully`]);
    setIsRunning(false);
  };

  const handleClear = () => {
    setNodes([]);
    setEdges([]);
    setRunLog([]);
    setWorkflowName("Untitled workflow");
  };

  const loadTemplate = (template: WorkflowTemplate) => {
    setNodes(template.nodes);
    setEdges(template.edges);
    setWorkflowName(template.name);
    setShowTemplates(false);
  };

  return (
    <div className="flex h-full flex-col">
      {/* top bar */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="bg-transparent text-sm font-medium focus:outline-none focus:ring-0"
          />
          <Badge variant="secondary" className="text-xs">
            {nodes.length} node{nodes.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowTemplates(!showTemplates)}
          >
            <LayoutTemplate className="h-3.5 w-3.5" />
            Templates
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleClear}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleSave}
          >
            <Save className="h-3.5 w-3.5" />
            {saved ? "Saved ✓" : "Save"}
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleRun}
            disabled={isRunning || nodes.length === 0}
          >
            <Play className="h-3.5 w-3.5" />
            {isRunning ? "Running..." : "Run"}
          </Button>
        </div>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        {/* node palette */}
        <NodePalette />

        {/* react flow canvas */}
        <div ref={reactFlowWrapper} className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            deleteKeyCode="Delete"
            style={{ background: "hsl(240 6% 4%)" }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="hsl(240 6% 18%)"
            />
            <Controls
              style={{
                background: "hsl(240 8% 9%)",
                border: "1px solid hsl(240 6% 18%)",
                borderRadius: "8px",
              }}
            />
            <MiniMap
              style={{
                background: "hsl(240 8% 9%)",
                border: "1px solid hsl(240 6% 18%)",
              }}
              nodeColor="hsl(263 70% 40%)"
            />

            {/* empty state */}
            {nodes.length === 0 && (
              <Panel position="top-center">
                <div className="mt-32 flex flex-col items-center gap-3 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card">
                    <span className="text-3xl">⚡</span>
                  </div>
                  <p className="text-sm font-medium">
                    Build your first workflow
                  </p>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    Drag nodes from the left panel onto the canvas, then connect
                    them by drawing from one handle to another. Or start with a
                    template.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setShowTemplates(true)}
                  >
                    <LayoutTemplate className="h-3.5 w-3.5" />
                    Use a template
                  </Button>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* template picker overlay */}
        {showTemplates && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <div className="w-[480px] rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/40">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Workflow templates</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Start from a pre-built automation
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setShowTemplates(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3">
                {WORKFLOW_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => loadTemplate(template)}
                    className="w-full rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                  >
                    <p className="text-sm font-medium">{template.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {template.description}
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {template.nodes.length} nodes
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {template.edges.length} connections
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* run log panel */}
        {runLog.length > 0 && (
          <div className="absolute bottom-4 right-4 w-72 rounded-xl border border-border bg-card p-4 shadow-xl shadow-black/30">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-medium">Run log</p>
              {!isRunning && (
                <button
                  onClick={() => setRunLog([])}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="space-y-1.5 font-mono">
              {runLog.map((line, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  {line}
                </p>
              ))}
              {isRunning && (
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

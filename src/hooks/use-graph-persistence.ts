"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import type { KnowledgeGraph } from "@/components/knowledge/knowledge-types";

interface NodePositions {
  [nodeId: string]: { x: number; y: number };
}

interface ViewportState {
  zoomLevel: number;
  panX: number;
  panY: number;
}

// explicit shape for partial viewport/position updates —
// avoids intersecting with NodePositions' index signature, which was
// causing "nodePositions" to be checked against the {x,y} index type
interface ViewportUpdate {
  nodePositions?: NodePositions;
  zoomLevel?: number;
  panX?: number;
  panY?: number;
  selectedNodeId?: string | null;
}

interface SavedGraphState {
  id: string;
  title: string;
  summary: string;
  graphData: KnowledgeGraph;
  nodePositions: NodePositions;
  zoomLevel: number;
  panX: number;
  panY: number;
  selectedNodeId: string | null;
  sourceFile: string | null;
  updatedAt: string;
}

export function useGraphPersistence() {
  const { workspaceId } = useWorkspace();
  const [savedGraph, setSavedGraph] = useState<SavedGraphState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // load saved graph on mount or workspace switch
  useEffect(() => {
    if (!workspaceId) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setSavedGraph(null);

    fetch(`/api/knowledge/graph?workspaceId=${workspaceId}`)
      .then((r) => r.json())
      .then((data) => {
        setSavedGraph(data.graph ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [workspaceId]);

  // save full graph data (called once after extraction)
  const saveGraph = useCallback(
    async (
      graph: KnowledgeGraph,
      sourceFile: string,
      initialPositions: NodePositions = {}
    ) => {
      if (!workspaceId) return;

      setSaving(true);
      try {
        await fetch("/api/knowledge/graph", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId,
            title: graph.title,
            summary: graph.summary,
            graphData: graph,
            nodePositions: initialPositions,
            zoomLevel: 1,
            panX: 0,
            panY: 0,
            selectedNodeId: null,
            sourceFile,
          }),
        });
      } catch (err) {
        console.error("Failed to save graph:", err);
      } finally {
        setSaving(false);
      }
    },
    [workspaceId]
  );

  // debounced save for viewport + positions (called on every drag/zoom)
  const saveViewport = useCallback(
    (update: ViewportUpdate) => {
      if (!workspaceId) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(async () => {
        try {
          await fetch("/api/knowledge/graph", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workspaceId, ...update }),
          });
        } catch (err) {
          console.error("Failed to save viewport:", err);
        }
      }, 500);
    },
    [workspaceId]
  );

  // save node positions specifically (after drag ends)
  const saveNodePositions = useCallback(
    (nodePositions: NodePositions) => {
      saveViewport({ nodePositions });
    },
    [saveViewport]
  );

  // save zoom + pan (after zoom/pan ends)
  const saveZoomPan = useCallback(
    (zoomLevel: number, panX: number, panY: number) => {
      saveViewport({ zoomLevel, panX, panY });
    },
    [saveViewport]
  );

  // save selected node
  const saveSelectedNode = useCallback(
    (selectedNodeId: string | null) => {
      saveViewport({ selectedNodeId });
    },
    [saveViewport]
  );

  // clear saved graph for this workspace
  const clearGraph = useCallback(async () => {
    if (!workspaceId) return;
    await fetch("/api/knowledge/graph", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    setSavedGraph(null);
  }, [workspaceId]);

  return {
    savedGraph,
    loading,
    saving,
    saveGraph,
    saveNodePositions,
    saveZoomPan,
    saveSelectedNode,
    clearGraph,
  };
}
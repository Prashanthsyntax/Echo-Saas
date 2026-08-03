"use client";

import { useState } from "react";
import { PdfUploader } from "@/components/knowledge/pdf-uploader";
import { KnowledgeGraphView } from "@/components/knowledge/knowledge-graph";
import type { KnowledgeGraph } from "@/components/knowledge/knowledge-types";
import { graphStore } from "@/lib/graph-store";
import { useGraphPersistence } from "@/hooks/use-graph-persistence";
import { Loader2 } from "lucide-react";

export default function KnowledgePage() {
  const [activeGraph, setActiveGraph] = useState<KnowledgeGraph | null>(null);

  const {
    savedGraph,
    loading,
    saving,
    saveGraph,
    saveNodePositions,
    saveZoomPan,
    saveSelectedNode,
    clearGraph,
  } = useGraphPersistence();

  // determine which graph to show:
  // 1. freshly extracted (activeGraph) takes priority
  // 2. fall back to savedGraph from DB
  const graphToShow = activeGraph ?? (savedGraph ? savedGraph.graphData as KnowledgeGraph : null);
  const savedPositions = activeGraph ? {} : (savedGraph?.nodePositions as Record<string, { x: number; y: number }> ?? {});
  const savedZoom = activeGraph ? 1 : (savedGraph?.zoomLevel ?? 1);
  const savedPanX = activeGraph ? 0 : (savedGraph?.panX ?? 0);
  const savedPanY = activeGraph ? 0 : (savedGraph?.panY ?? 0);
  const savedSelectedNodeId = activeGraph ? null : (savedGraph?.selectedNodeId ?? null);

  const handleGraphReady = async (g: KnowledgeGraph, sourceFile: string) => {
    setActiveGraph(g);
    graphStore.set(g);
    // save full graph to DB
    await saveGraph(g, sourceFile);
  };

  const handleReset = async () => {
    setActiveGraph(null);
    graphStore.set(null);
    await clearGraph();
  };

  // loading state while checking DB for saved graph
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-white/30">Loading your knowledge graph...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden">
      {graphToShow ? (
        <KnowledgeGraphView
          graph={graphToShow}
          onReset={handleReset}
          initialNodePositions={savedPositions}
          initialZoom={savedZoom}
          initialPanX={savedPanX}
          initialPanY={savedPanY}
          initialSelectedNodeId={savedSelectedNodeId}
          onNodePositionsChange={saveNodePositions}
          onZoomPanChange={saveZoomPan}
          onSelectedNodeChange={saveSelectedNode}
          saving={saving}
        />
      ) : (
        <PdfUploader onGraphReady={(g) => handleGraphReady(g, "uploaded document")} />
      )}
    </div>
  );
}
"use client";

import { useState } from "react";
import { PdfUploader } from "@/components/knowledge/pdf-uploader";
import { KnowledgeGraphView } from "@/components/knowledge/knowledge-graph";
import type { KnowledgeGraph } from "@/components/knowledge/knowledge-types";
import { graphStore } from "@/lib/graph-store";


export default function KnowledgePage() {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);

  const handleGraphReady = (g: KnowledgeGraph) => {
    setGraph(g);
    graphStore.set(g); // share with chat page
  };

  return (
    <div className="h-full overflow-hidden">
      {graph ? (
        <KnowledgeGraphView
          graph={graph}
          onReset={() => {
            setGraph(null);
            graphStore.set(null);
          }}
        />
      ) : (
        <PdfUploader onGraphReady={handleGraphReady} />
      )}
    </div>
  );
}
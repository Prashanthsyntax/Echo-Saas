"use client";

import { useState } from "react";
import { PdfUploader } from "@/components/knowledge/pdf-uploader";
import { KnowledgeGraphView } from "@/components/knowledge/knowledge-graph";
import type { KnowledgeGraph } from "@/components/knowledge/knowledge-types";

export default function KnowledgePage() {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);

  return (
    <div className="h-full overflow-hidden">
      {graph ? (
        <KnowledgeGraphView
          graph={graph}
          onReset={() => setGraph(null)}
        />
      ) : (
        <PdfUploader onGraphReady={setGraph} />
      )}
    </div>
  );
}
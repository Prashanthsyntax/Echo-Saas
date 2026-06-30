export interface KnowledgeNode {
  id: string;
  label: string;
  type: "concept" | "person" | "organization" | "process" | "technology" | "location" | "event";
  description: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface KnowledgeEdge {
  source: string | KnowledgeNode;
  target: string | KnowledgeNode;
  label: string;
}

export interface KnowledgeGraph {
  title: string;
  summary: string;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export const NODE_COLORS: Record<KnowledgeNode["type"], string> = {
  concept: "#8B5CF6",       // violet
  person: "#0EA5E9",        // sky
  organization: "#10B981",  // emerald
  process: "#F59E0B",       // amber
  technology: "#EC4899",    // pink
  location: "#14B8A6",      // teal
  event: "#EF4444",         // red
};

export const NODE_TYPE_LABELS: Record<KnowledgeNode["type"], string> = {
  concept: "Concept",
  person: "Person",
  organization: "Organization",
  process: "Process",
  technology: "Technology",
  location: "Location",
  event: "Event",
};
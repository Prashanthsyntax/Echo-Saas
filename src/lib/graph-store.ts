import type { KnowledgeGraph } from "@/components/knowledge/knowledge-types";

// module-level singleton — persists across page navigations within the same session
let currentGraph: KnowledgeGraph | null = null;
const listeners: Array<(graph: KnowledgeGraph | null) => void> = [];

export const graphStore = {
  get(): KnowledgeGraph | null {
    return currentGraph;
  },

  set(graph: KnowledgeGraph | null) {
    currentGraph = graph;
    listeners.forEach((fn) => fn(graph));
  },

  subscribe(fn: (graph: KnowledgeGraph | null) => void) {
    listeners.push(fn);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  },
};
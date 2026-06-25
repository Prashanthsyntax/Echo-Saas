/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@clerk/nextjs/server";
import { groq } from "@/lib/groq";
import { NextResponse } from "next/server";
import type { KnowledgeGraph } from "@/components/knowledge/knowledge-types";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messages, graph } = await req.json() as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    graph: KnowledgeGraph;
  };

  if (!graph || !graph.nodes?.length) {
    return NextResponse.json(
      { error: "No knowledge graph provided" },
      { status: 400 }
    );
  }

  // build a compact text representation of the graph for the model
  const nodeList = graph.nodes
    .map((n) => `- [${n.type.toUpperCase()}] ${n.label}: ${n.description}`)
    .join("\n");

  const edgeList = graph.edges
    .map((e) => {
      const sourceId = typeof e.source === "string"
        ? e.source
        : (e.source as any).id;
      const targetId = typeof e.target === "string"
        ? e.target
        : (e.target as any).id;
      const sourceNode = graph.nodes.find((n) => n.id === sourceId);
      const targetNode = graph.nodes.find((n) => n.id === targetId);
      return `- "${sourceNode?.label}" ${e.label} "${targetNode?.label}"`;
    })
    .join("\n");

  const systemPrompt = `You are an expert analyst helping users understand a knowledge graph extracted from a document.

Document: "${graph.title}"
Summary: ${graph.summary}

KNOWLEDGE GRAPH:

Nodes (${graph.nodes.length} entities):
${nodeList}

Relationships (${graph.edges.length} connections):
${edgeList}

Your job:
- Answer questions about the entities, concepts, and relationships in this graph
- Explain how different concepts are connected
- Identify clusters, patterns, and key themes
- Highlight the most central/important nodes
- Trace paths between concepts when asked
- Be specific — reference actual node names and relationship labels from the graph
- Keep answers concise but complete (3-6 sentences for simple questions, more for complex ones)
- If asked something not covered by the graph, say so clearly rather than guessing`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.slice(-12),
      ],
      temperature: 0.3,
      max_tokens: 600,
      stream: false,
    });

    const content =
      completion.choices[0]?.message?.content ?? "No response generated.";

    return NextResponse.json({ content });
  } catch (err) {
    console.error("Graph chat error:", err);
    return NextResponse.json(
      { error: "Chat request failed" },
      { status: 500 }
    );
  }
}
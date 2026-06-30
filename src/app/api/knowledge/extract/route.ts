/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@clerk/nextjs/server";
import { groq } from "@/lib/groq";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { text, filename } = await req.json();

  if (!text || text.trim().length < 50) {
    return NextResponse.json(
      { error: "Text too short to extract knowledge from" },
      { status: 400 }
    );
  }

  // truncate to avoid Groq context limits
  const truncated = text.slice(0, 12000);

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are a knowledge graph extraction expert. Extract entities and relationships from text and return ONLY valid JSON. No markdown, no explanation, just raw JSON.`,
        },
        {
          role: "user",
          content: `Extract a knowledge graph from this document: "${filename}"

Text:
${truncated}

Return ONLY this JSON structure (no markdown, no backticks):
{
  "title": "short descriptive title for this document",
  "summary": "2-3 sentence summary of the document",
  "nodes": [
    {
      "id": "unique_id",
      "label": "Entity Name",
      "type": "concept|person|organization|process|technology|location|event",
      "description": "brief description"
    }
  ],
  "edges": [
    {
      "source": "node_id",
      "target": "node_id",
      "label": "relationship verb"
    }
  ]
}

Rules:
- Extract 8-20 nodes (key concepts, people, orgs, processes)
- Extract 10-25 edges (meaningful relationships between nodes)
- Node IDs must be simple strings like "node1", "node2"
- Edge source/target must match existing node IDs exactly
- Labels should be concise (1-4 words)
- Focus on the most important concepts in the document`,
        },
      ],
      temperature: 0.2,
      max_tokens: 3000,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const cleaned = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let graph;
    try {
      graph = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse graph from AI response" },
        { status: 500 }
      );
    }

    // validate structure
    if (!graph.nodes || !Array.isArray(graph.nodes)) {
      return NextResponse.json(
        { error: "Invalid graph structure returned" },
        { status: 500 }
      );
    }

    // ensure edge source/target exist in nodes
    const nodeIds = new Set(graph.nodes.map((n: any) => n.id));
    graph.edges = (graph.edges ?? []).filter(
      (e: any) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );

    return NextResponse.json(graph);
  } catch (err) {
    console.error("Knowledge extraction error:", err);
    return NextResponse.json(
      { error: "Extraction failed" },
      { status: 500 }
    );
  }
}
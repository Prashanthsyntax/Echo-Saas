/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { groq } from "@/lib/groq";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { nodeId } = await params;

  const node = await db.kGNode.findUnique({
    where:   { id: nodeId },
    include: {
      outgoingEdges: {
        include: { target: { select: { id: true, label: true, nodeType: true } } },
        take: 10,
      },
      incomingEdges: {
        include: { source: { select: { id: true, label: true, nodeType: true } } },
        take: 10,
      },
      chunks: {
        include: {
          chunk: {
            select: {
              content:    true,
              pageNumber: true,
              source:     { select: { name: true, id: true } },
            },
          },
        },
        take:    5,
        orderBy: { confidence: "desc" },
      },
    },
  });

  if (!node) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // return cached theory if fresh (< 24h)
  if (node.theoryCache) {
    const cache    = node.theoryCache as any;
    const cacheAge = Date.now() - new Date(cache.generatedAt).getTime();
    if (cacheAge < 24 * 60 * 60 * 1000) {
      return NextResponse.json({ theory: cache, node, fromCache: true });
    }
  }

  // build source context from actual chunks — GROUNDING
  const sourceChunks = node.chunks.map(nc => ({
    content:    nc.chunk.content.slice(0, 600),
    source:     nc.chunk.source.name,
    sourceId:   nc.chunk.source.id,
    page:       nc.chunk.pageNumber,
    confidence: nc.confidence,
  }));

  const sourceContext = sourceChunks.length > 0
    ? sourceChunks.map((c, i) =>
        `[Source ${i+1}: ${c.source}${c.page ? `, p.${c.page}` : ""}]\n${c.content}`
      ).join("\n\n")
    : `Concept: ${node.label} (${node.nodeType})`;

  const relationships = [
    ...node.outgoingEdges.map(e => `${node.label} --[${e.edgeType}]--> ${e.target.label}`),
    ...node.incomingEdges.map(e => `${e.source.label} --[${e.edgeType}]--> ${node.label}`),
  ];

  const prompt = `You are a knowledge synthesis expert. Generate a comprehensive theory view for this concept.

IMPORTANT: Base your response ONLY on the source content provided below. Do not add information not present in the sources.

Concept: "${node.label}" (Type: ${node.nodeType})
${node.description ? `Description: ${node.description}` : ""}

Known relationships:
${relationships.length > 0 ? relationships.join("\n") : "No relationships extracted yet."}

Source content (grounding material):
${sourceContext}

Generate a theory view in JSON:
{
  "definition": "1-2 sentence definition grounded in the sources",
  "keyConcepts": [
    {"concept": "name", "explanation": "brief explanation from sources"}
  ],
  "howItWorks": "paragraph explaining the mechanism/process from sources",
  "examples": [
    {"example": "concrete example", "source": "source name"}
  ],
  "relationships": [
    {"related": "concept name", "type": "relationship type", "explanation": "why they're related"}
  ],
  "deeperContext": "2-3 sentences of broader significance",
  "keyInsights": ["insight 1", "insight 2", "insight 3"],
  "sourceReferences": [
    {"source": "doc name", "page": null, "relevantQuote": "short exact quote"}
  ],
  "confidence": 0.0 to 1.0
}

If the sources don't contain enough information, say so in the definition field rather than fabricating content.`;

  const res = await groq.chat.completions.create({
    model:       "openai/gpt-oss-120b",
    messages:    [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens:  1500,
    response_format: { type: "json_object" },
  });

  const raw    = res.choices[0]?.message?.content ?? "{}";
  let   theory: any;
  try   { theory = JSON.parse(raw); }
  catch { theory = { definition: node.label, keyConcepts: [], examples: [], relationships: [] }; }

  theory.generatedAt  = new Date().toISOString();
  theory.sourceChunks = sourceChunks;
  theory.nodeId       = nodeId;

  // cache theory on node
  await db.kGNode.update({
    where: { id: nodeId },
    data:  { theoryCache: theory },
  });

  return NextResponse.json({ theory, node, fromCache: false });
}
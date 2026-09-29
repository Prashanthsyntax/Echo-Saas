/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const CHROMA = process.env.CHROMA_SERVICE_URL ?? "http://localhost:8000";

// GET — list all nodes with edges
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId  = searchParams.get("workspaceId")!;
  const nodeType     = searchParams.get("nodeType");
  const minConf      = parseFloat(searchParams.get("minConfidence") ?? "0");
  const sourceId     = searchParams.get("sourceId");
  const search       = searchParams.get("search");

  // semantic search mode
  if (search) {
    const searchRes = await fetch(`${CHROMA}/kg/search`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ workspace_id: workspaceId, query: search, n_results: 20 }),
    });
    const searchData  = await searchRes.json();
    const nodeIds     = searchData.results.map((r: any) => r.node_id).filter(Boolean);
    const nodes       = await db.kGNode.findMany({
      where:   { id: { in: nodeIds }, status: { not: "DELETED" } },
      include: {
        outgoingEdges: { include: { target: { select: { id: true, label: true } } } },
        incomingEdges: { include: { source: { select: { id: true, label: true } } } },
        chunks:        { include: { chunk: { select: { content: true, pageNumber: true, source: { select: { name: true } } } } }, take: 3 },
      },
    });
    return NextResponse.json({ nodes, searchMode: true });
  }

  const nodes = await db.kGNode.findMany({
    where: {
      workspaceId,
      status:     { not: "DELETED" },
      ...(nodeType     ? { nodeType: nodeType as any }        : {}),
      ...(minConf > 0  ? { confidence: { gte: minConf } }    : {}),
      ...(sourceId     ? { primarySourceId: sourceId }        : {}),
    },
    include: {
      outgoingEdges: {
        where:   { target: { status: { not: "DELETED" } } },
        include: { target: { select: { id: true, label: true, nodeType: true } } },
        take:    50,
      },
      incomingEdges: {
        where:   { source: { status: { not: "DELETED" } } },
        include: { source: { select: { id: true, label: true, nodeType: true } } },
        take:    50,
      },
      chunks: {
        include: {
          chunk: {
            select: {
              content:    true,
              pageNumber: true,
              source:     { select: { name: true } },
            },
          },
        },
        take: 2,
      },
    },
    orderBy: { confidence: "desc" },
    take:    200,
  });

  return NextResponse.json({ nodes });
}

// POST — create manual node
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId, label, nodeType, description, color } = await req.json();

  const node = await db.kGNode.create({
    data: {
      workspaceId,
      label,
      nodeType:    nodeType ?? "CONCEPT",
      description: description ?? null,
      color:       color ?? null,
      confidence:  1.0,
      extractedBy: "user",
      aliases:     [],
    },
  });

  // index in ChromaDB
  await fetch(`${CHROMA}/kg/index-node`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      workspace_id: workspaceId,
      node_id:      node.id,
      label,
      description:  description ?? label,
      node_type:    nodeType ?? "CONCEPT",
      confidence:   1.0,
    }),
  }).catch(() => {});

  return NextResponse.json({ node });
}
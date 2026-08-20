import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

// GET — Load workspace knowledge graph
export async function GET(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId required" },
      { status: 400 },
    );
  }

  const user = await db.user.findUnique({
    where: { clerkId: userId },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Ensure user belongs to workspace
  const membership = await db.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId,
      },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Workspace shared graph
  const graph = await db.knowledgeGraph.findFirst({
    where: {
      workspaceId,
    },
  });

  return NextResponse.json({
    graph: graph ?? null,
  });
}

// POST — Create or replace workspace graph
export async function POST(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    workspaceId,
    title,
    summary,
    graphData,
    nodePositions = {},
    zoomLevel = 1,
    panX = 0,
    panY = 0,
    selectedNodeId = null,
    sourceFile = null,
  } = await req.json();

  if (!workspaceId || !title || !graphData) {
    return NextResponse.json(
      { error: "workspaceId, title, graphData required" },
      { status: 400 },
    );
  }

  const user = await db.user.findUnique({
    where: { clerkId: userId },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const membership = await db.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId,
      },
    },
  });

  if (
    !membership ||
    !hasPermission(membership.role, "INGEST_DOCUMENTS")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.knowledgeGraph.findFirst({
    where: {
      workspaceId,
    },
  });

  let graph;

  if (existing) {
    graph = await db.knowledgeGraph.update({
      where: {
        id: existing.id,
      },
      data: {
        title,
        summary,
        graphData,
        nodePositions,
        zoomLevel,
        panX,
        panY,
        selectedNodeId,
        sourceFile,
      },
    });
  } else {
    graph = await db.knowledgeGraph.create({
      data: {
        userId: user.id,
        workspaceId,
        title,
        summary,
        graphData,
        nodePositions,
        zoomLevel,
        panX,
        panY,
        selectedNodeId,
        sourceFile,
      },
    });
  }

  return NextResponse.json({
    graphId: graph.id,
  });
}

// PATCH — Update viewport/positions
export async function PATCH(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    workspaceId,
    nodePositions,
    zoomLevel,
    panX,
    panY,
    selectedNodeId,
  } = await req.json();

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId required" },
      { status: 400 },
    );
  }

  const user = await db.user.findUnique({
    where: { clerkId: userId },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const membership = await db.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId,
      },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const graph = await db.knowledgeGraph.findFirst({
    where: {
      workspaceId,
    },
  });

  if (!graph) {
    return NextResponse.json(
      { error: "Graph not found" },
      { status: 404 },
    );
  }

  await db.knowledgeGraph.update({
    where: {
      id: graph.id,
    },
    data: {
      ...(nodePositions !== undefined && { nodePositions }),
      ...(zoomLevel !== undefined && { zoomLevel }),
      ...(panX !== undefined && { panX }),
      ...(panY !== undefined && { panY }),
      ...(selectedNodeId !== undefined && { selectedNodeId }),
    },
  });

  return NextResponse.json({
    success: true,
  });
}

// DELETE — Remove workspace graph (OWNER/ADMIN only)
export async function DELETE(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await req.json();

  if (!workspaceId) {
    return NextResponse.json(
      { error: "workspaceId required" },
      { status: 400 },
    );
  }

  const user = await db.user.findUnique({
    where: { clerkId: userId },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const membership = await db.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId,
      },
    },
  });

  if (
    !membership ||
    (membership.role !== "OWNER" && membership.role !== "ADMIN")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.knowledgeGraph.deleteMany({
    where: {
      workspaceId,
    },
  });

  return NextResponse.json({
    success: true,
  });
}
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET — load saved graph for current workspace
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ graph: null });

  const graph = await db.knowledgeGraph.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });

  if (!graph) return NextResponse.json({ graph: null });

  return NextResponse.json({ graph });
}

// POST — save or update graph for current workspace
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
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const graph = await db.knowledgeGraph.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
    update: {
      title,
      summary,
      graphData,
      nodePositions,
      zoomLevel,
      panX,
      panY,
      selectedNodeId,
      sourceFile,
      updatedAt: new Date(),
    },
    create: {
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

  return NextResponse.json({ graphId: graph.id });
}

// PATCH — update only viewport/positions (called frequently on drag/zoom)
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
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await db.knowledgeGraph.updateMany({
    where: { userId: user.id, workspaceId },
    data: {
      ...(nodePositions !== undefined && { nodePositions }),
      ...(zoomLevel !== undefined && { zoomLevel }),
      ...(panX !== undefined && { panX }),
      ...(panY !== undefined && { panY }),
      ...(selectedNodeId !== undefined && { selectedNodeId }),
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}

// DELETE — clear saved graph for current workspace
export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await req.json();

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await db.knowledgeGraph.deleteMany({
    where: { userId: user.id, workspaceId },
  });

  return NextResponse.json({ success: true });
}
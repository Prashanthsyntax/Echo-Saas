import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET — load saved canvas for current workspace
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
  if (!user) return NextResponse.json({ state: null });

  const state = await db.canvasState.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });

  return NextResponse.json({ state: state ?? null });
}

// POST — save full canvas state
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    workspaceId,
    canvasData,
    viewportX = 0,
    viewportY = 0,
    zoomLevel = 1,
    objectCount = 0,
  } = await req.json();

  if (!workspaceId || !canvasData) {
    return NextResponse.json(
      { error: "workspaceId and canvasData required" },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const state = await db.canvasState.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
    update: {
      canvasData,
      viewportX,
      viewportY,
      zoomLevel,
      objectCount,
      updatedAt: new Date(),
    },
    create: {
      userId: user.id,
      workspaceId,
      canvasData,
      viewportX,
      viewportY,
      zoomLevel,
      objectCount,
    },
  });

  return NextResponse.json({ stateId: state.id, objectCount: state.objectCount });
}

// DELETE — clear canvas for current workspace
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

  await db.canvasState.deleteMany({
    where: { userId: user.id, workspaceId },
  });

  return NextResponse.json({ success: true });
}
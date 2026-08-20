import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/permissions";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, canvasData, viewportX = 0, viewportY = 0, zoomLevel = 1, objectCount = 0 } =
    await req.json();

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

  // check EDIT_CANVAS permission
  const membership = await db.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  if (!hasPermission(membership.role, "EDIT_CANVAS")) {
    return NextResponse.json(
      { error: "Your role cannot edit the canvas" },
      { status: 403 }
    );
  }

  // find existing state for this workspace (not per user)
  const existing = await db.canvasState.findFirst({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
  });

  let state;
  if (existing) {
    state = await db.canvasState.update({
      where: { id: existing.id },
      data: { canvasData, viewportX, viewportY, zoomLevel, objectCount, updatedAt: new Date() },
    });
  } else {
    state = await db.canvasState.create({
      data: { userId: user.id, workspaceId, canvasData, viewportX, viewportY, zoomLevel, objectCount },
    });
  }

  return NextResponse.json({ stateId: state.id, objectCount: state.objectCount });
}

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

  const membership = await db.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });
  if (!membership) return NextResponse.json({ state: null });

  // load workspace canvas — shared by all members
  const state = await db.canvasState.findFirst({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ state: state ?? null });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await req.json();

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await db.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });

  // only OWNER/ADMIN can clear the shared canvas
  if (!membership || !hasPermission(membership.role, "CLEAR_CANVAS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.canvasState.deleteMany({ where: { workspaceId } });
  return NextResponse.json({ success: true });
}

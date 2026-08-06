import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireWorkspacePermission } from "@/lib/workspace-auth";
import { logActivity } from "@/lib/activity";
import type { Role } from "@prisma/client";

// GET — fetch workspace settings + workspace info
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;

  const result = await requireWorkspacePermission(workspaceId, "VIEW_MEMBERS");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const [workspace, settings] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        description: true,
        plan: true,
        createdAt: true,
        _count: {
          select: { memberships: true, videos: true },
        },
      },
    }),
    db.workspaceSettings.findUnique({
      where: { workspaceId },
    }),
  ]);

  return NextResponse.json({ workspace, settings });
}

// PATCH — update workspace general info (name, description)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;

  const result = await requireWorkspacePermission(
    workspaceId,
    "UPDATE_SETTINGS"
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { name, description } = await req.json();

  const oldWorkspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });

  const updated = await db.workspace.update({
    where: { id: workspaceId },
    data: {
      ...(name?.trim() && { name: name.trim() }),
      ...(description !== undefined && { description }),
    },
  });

  if (name && name.trim() !== oldWorkspace?.name) {
    await logActivity({
      workspaceId,
      userId: result.user.id,
      type: "WORKSPACE_RENAMED",
      description: `renamed workspace from "${oldWorkspace?.name}" to "${name.trim()}"`,
      metadata: { oldName: oldWorkspace?.name, newName: name.trim() },
    });
  }

  return NextResponse.json({ workspace: updated });
}
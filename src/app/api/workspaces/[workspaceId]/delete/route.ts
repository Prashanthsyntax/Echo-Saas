import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireWorkspacePermission } from "@/lib/workspace-auth";

// DELETE — permanently delete workspace (OWNER only)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;

  const result = await requireWorkspacePermission(
    workspaceId,
    "DELETE_WORKSPACE"
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // delete workspace — cascades to memberships, videos, settings, etc.
  await db.workspace.delete({ where: { id: workspaceId } });

  return NextResponse.json({ success: true });
}
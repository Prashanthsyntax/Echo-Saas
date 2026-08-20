import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireWorkspacePermission } from "@/lib/workspace-auth";
import { logActivity } from "@/lib/activity";

// POST — transfer ownership to another member
export async function POST(
  req: Request,
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

  const { newOwnerId } = await req.json();
  if (!newOwnerId) {
    return NextResponse.json(
      { error: "newOwnerId required" },
      { status: 400 }
    );
  }

  // verify new owner is a member
  const newOwnerMembership = await db.membership.findUnique({
    where: {
      userId_workspaceId: { userId: newOwnerId, workspaceId },
    },
    include: { user: true },
  });

  if (!newOwnerMembership) {
    return NextResponse.json(
      { error: "New owner must be a member of this workspace" },
      { status: 400 }
    );
  }

  // downgrade current owner to ADMIN, upgrade new owner to OWNER
  await db.$transaction([
    db.membership.update({
      where: {
        userId_workspaceId: {
          userId: result.user.id,
          workspaceId,
        },
      },
      data: { role: "ADMIN" },
    }),
    db.membership.update({
      where: {
        userId_workspaceId: { userId: newOwnerId, workspaceId },
      },
      data: { role: "OWNER" },
    }),
  ]);

  await logActivity({
    workspaceId,
    userId: result.user.id,
    type: "MEMBER_ROLE_CHANGED",
    description: `transferred ownership to ${newOwnerMembership.user.name ?? newOwnerMembership.user.email}`,
    metadata: { newOwnerId, newOwnerName: newOwnerMembership.user.name },
  });

  return NextResponse.json({ success: true });
}
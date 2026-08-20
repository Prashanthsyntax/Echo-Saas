import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireWorkspacePermission } from "@/lib/workspace-auth";
import { logActivity } from "@/lib/activity";
import { outranks } from "@/lib/permissions";
import type { Role } from "@prisma/client";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;

  const result = await requireWorkspacePermission(workspaceId, "CHANGE_ROLE");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { memberId, newRole } = await req.json() as {
    memberId: string;
    newRole: Role;
  };

  const validRoles: Role[] = ["OWNER", "ADMIN", "EDITOR", "VIEWER"];
  if (!validRoles.includes(newRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  // find the target member
  const targetMembership = await db.membership.findUnique({
    where: { userId_workspaceId: { userId: memberId, workspaceId } },
    include: { user: true },
  });

  if (!targetMembership) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // can't change role of someone with equal or higher rank
  if (!outranks(result.membership.role, targetMembership.role)) {
    return NextResponse.json(
      { error: "Cannot change role of a member with equal or higher rank" },
      { status: 403 }
    );
  }

  // can't assign a role higher than your own
  if (outranks(newRole, result.membership.role)) {
    return NextResponse.json(
      { error: "Cannot assign a role higher than your own" },
      { status: 403 }
    );
  }

  const oldRole = targetMembership.role;

  await db.membership.update({
    where: { userId_workspaceId: { userId: memberId, workspaceId } },
    data: { role: newRole },
  });

  await logActivity({
    workspaceId,
    userId: result.user.id,
    type: "MEMBER_ROLE_CHANGED",
    description: `Changed ${targetMembership.user.name ?? targetMembership.user.email}'s role from ${oldRole} to ${newRole}`,
    metadata: { memberId, oldRole, newRole, memberName: targetMembership.user.name },
  });

  return NextResponse.json({ success: true, oldRole, newRole });
}
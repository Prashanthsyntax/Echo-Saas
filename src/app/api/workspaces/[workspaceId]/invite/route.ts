import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireWorkspacePermission } from "@/lib/workspace-auth";
import { logActivity } from "@/lib/activity";
import { outranks } from "@/lib/permissions";
import type { Role } from "@prisma/client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;

  const result = await requireWorkspacePermission(workspaceId, "INVITE_MEMBER");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { email, role } = await req.json() as { email?: string; role?: Role };

  if (!email?.trim()) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  // get workspace settings for default role
  const settings = await db.workspaceSettings.findUnique({
    where: { workspaceId },
  });

  const inviteRole = role ?? settings?.defaultRole ?? "VIEWER";
  const validInviteRoles: Role[] = ["ADMIN", "EDITOR", "VIEWER"];

  if (!validInviteRoles.includes(inviteRole)) {
    return NextResponse.json({ error: "Invalid invite role" }, { status: 400 });
  }

  if (!outranks(result.membership.role, inviteRole)) {
    return NextResponse.json(
      { error: "Cannot invite a member with equal or higher rank" },
      { status: 403 }
    );
  }

  // check if already a member
  const existingUser = await db.user.findUnique({
    where: { email: email.trim() },
  });

  if (existingUser) {
    const existingMembership = await db.membership.findUnique({
      where: {
        userId_workspaceId: { userId: existingUser.id, workspaceId },
      },
    });
    if (existingMembership) {
      return NextResponse.json(
        { error: "User is already a member of this workspace" },
        { status: 400 }
      );
    }
  }

  // check for existing pending invite
  const existingInvite = await db.invite.findFirst({
    where: { workspaceId, email: email.trim(), accepted: false },
  });

  if (existingInvite) {
    return NextResponse.json(
      { error: "Invite already sent to this email" },
      { status: 400 }
    );
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invite = await db.invite.create({
    data: {
      email: email.trim(),
      workspaceId,
      role: inviteRole,
      expiresAt,
    },
  });

  await logActivity({
    workspaceId,
    userId: result.user.id,
    type: "INVITE_SENT",
    description: `Invited ${email.trim()} as ${inviteRole}`,
    metadata: { email: email.trim(), role: inviteRole },
  });

  return NextResponse.json({
    invite,
    inviteLink: `${process.env.APP_URL}/invite/${invite.token}`,
  });
}

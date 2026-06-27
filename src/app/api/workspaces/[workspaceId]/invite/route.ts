import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId } = await params;
  const { email } = await req.json();

  if (!email?.trim()) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await db.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });

  if (!membership || membership.role === "MEMBER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // check if already a member
  const existingUser = await db.user.findUnique({ where: { email: email.trim() } });
  if (existingUser) {
    const existingMembership = await db.membership.findUnique({
      where: { userId_workspaceId: { userId: existingUser.id, workspaceId } },
    });
    if (existingMembership) {
      return NextResponse.json({ error: "User is already a member" }, { status: 400 });
    }
  }

  // check for existing pending invite
  const existingInvite = await db.invite.findFirst({
    where: { workspaceId, email: email.trim(), accepted: false },
  });
  if (existingInvite) {
    return NextResponse.json({ error: "Invite already sent to this email" }, { status: 400 });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invite = await db.invite.create({
    data: {
      email: email.trim(),
      workspaceId,
      expiresAt,
    },
  });

  return NextResponse.json({
    invite,
    inviteLink: `${process.env.APP_URL}/invite/${invite.token}`,
  });
}
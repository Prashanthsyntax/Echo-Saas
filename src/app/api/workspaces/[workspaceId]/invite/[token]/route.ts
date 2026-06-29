import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; token: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId, token } = await params;
  const clerkUser = await currentUser();
  if (!clerkUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invite = await db.invite.findUnique({ where: { token } });

  if (!invite || invite.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
  }

  if (invite.accepted) {
    return NextResponse.json({ error: "Invite already used" }, { status: 400 });
  }

  if (new Date() > invite.expiresAt) {
    return NextResponse.json({ error: "Invite expired" }, { status: 400 });
  }

  let user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    user = await db.user.create({
      data: {
        clerkId: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
        name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null,
        imageUrl: clerkUser.imageUrl,
      },
    });
  }

  await db.membership.create({
    data: {
      userId: user.id,
      workspaceId,
      role: invite.role,
    },
  });

  await db.invite.update({
    where: { token },
    data: { accepted: true },
  });

  return NextResponse.json({ success: true, workspaceId });
}
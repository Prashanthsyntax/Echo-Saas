import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { outranks } from "@/lib/permissions";
import { requireWorkspacePermission } from "@/lib/workspace-auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // verify requester is a member of this workspace
  const membership = await db.membership.findUnique({
    where: {
      userId_workspaceId: { userId: user.id, workspaceId },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [members, invites] = await Promise.all([
    db.membership.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.invite.findMany({
      where: { workspaceId, accepted: false },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json(
    { members, invites },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    }
  );
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await params;
  const { memberId } = await req.json();

  const result = await requireWorkspacePermission(workspaceId, "REMOVE_MEMBER");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const targetMembership = await db.membership.findUnique({
    where: {
      userId_workspaceId: { userId: memberId, workspaceId },
    },
  });

  if (!targetMembership) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (memberId === result.user.id) {
    return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
  }

  if (!outranks(result.membership.role, targetMembership.role)) {
    return NextResponse.json(
      { error: "Cannot remove a member with equal or higher rank" },
      { status: 403 }
    );
  }

  await db.membership.delete({
    where: {
      userId_workspaceId: { userId: memberId, workspaceId },
    },
  });

  return NextResponse.json({ success: true });
}

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

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

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const requester = await db.membership.findUnique({
    where: {
      userId_workspaceId: { userId: user.id, workspaceId },
    },
  });

  if (!requester || requester.role === "VIEWER" || requester.role === "EDITOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.membership.delete({
    where: {
      userId_workspaceId: { userId: memberId, workspaceId },
    },
  });

  return NextResponse.json({ success: true });
}
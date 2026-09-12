import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET — fetch workspace board with all cards
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const membership = await db.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // get or create the workspace board
  let board = await db.kanbanBoard.findUnique({
    where: { workspaceId },
    include: {
      cards: {
        include: {
          assignee: { select: { id: true, name: true, email: true, imageUrl: true } },
          creator:  { select: { id: true, name: true, email: true, imageUrl: true } },
          _count:   { select: { comments: true, attachments: true } },
        },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!board) {
    board = await db.kanbanBoard.create({
      data: { workspaceId, name: "Platform board" },
      include: {
        cards: {
          include: {
            assignee: { select: { id: true, name: true, email: true, imageUrl: true } },
            creator:  { select: { id: true, name: true, email: true, imageUrl: true } },
            _count:   { select: { comments: true, attachments: true } },
          },
          orderBy: { position: "asc" },
        },
      },
    });
  }

  // also return workspace members for assignee picker
  const members = await db.membership.findMany({
    where: { workspaceId },
    include: {
      user: { select: { id: true, name: true, email: true, imageUrl: true } },
    },
  });

  return NextResponse.json({
    board,
    members: members.map(m => ({ ...m.user, role: m.role })),
    updatedAt: board.updatedAt,
  });
}

// PATCH — rename board
export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId, name } = await req.json();

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const board = await db.kanbanBoard.update({
    where: { workspaceId },
    data: { name },
  });

  return NextResponse.json({ board });
}
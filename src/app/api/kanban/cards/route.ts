import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

function generateTicketId() {
  const prefix = "MOSAIC";
  const num = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${num}`;
}

// POST — create card
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId, title, column = "todo", label, labelColor, assigneeId, description } =
    await req.json();

  if (!workspaceId || !title?.trim()) {
    return NextResponse.json({ error: "workspaceId and title required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let board = await db.kanbanBoard.findUnique({ where: { workspaceId } });
  if (!board) {
    board = await db.kanbanBoard.create({ data: { workspaceId } });
  }

  // get max position in column
  const maxPos = await db.kanbanCard.aggregate({
    where: { boardId: board.id, column },
    _max: { position: true },
  });

  const card = await db.kanbanCard.create({
    data: {
      boardId:     board.id,
      ticketId:    generateTicketId(),
      title:       title.trim(),
      column,
      position:    (maxPos._max.position ?? -1) + 1,
      label:       label ?? null,
      labelColor:  labelColor ?? null,
      assigneeId:  assigneeId ?? null,
      description: description ?? null,
      creatorId:   user.id,
    },
    include: {
      assignee: { select: { id: true, name: true, email: true, imageUrl: true } },
      creator:  { select: { id: true, name: true, email: true, imageUrl: true } },
      _count:   { select: { comments: true, attachments: true } },
    },
  });

  // update board updatedAt for real-time sync
  await db.kanbanBoard.update({ where: { id: board.id }, data: { updatedAt: new Date() } });

  return NextResponse.json({ card });
}
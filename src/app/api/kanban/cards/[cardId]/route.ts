import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET — fetch single card with comments
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;

  const card = await db.kanbanCard.findUnique({
    where: { id: cardId },
    include: {
      assignee: { select: { id: true, name: true, email: true, imageUrl: true } },
      creator:  { select: { id: true, name: true, email: true, imageUrl: true } },
      comments: {
        include: { user: { select: { id: true, name: true, email: true, imageUrl: true } } },
        orderBy: { createdAt: "asc" },
      },
      attachments: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ card });
}

// PATCH — update card (title, description, label, assignee, column, position)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cardId } = await params;
  const body = await req.json();

  const card = await db.kanbanCard.update({
    where: { id: cardId },
    data: {
      ...(body.title       !== undefined && { title:       body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.label       !== undefined && { label:       body.label }),
      ...(body.labelColor  !== undefined && { labelColor:  body.labelColor }),
      ...(body.assigneeId  !== undefined && { assigneeId:  body.assigneeId }),
      ...(body.column      !== undefined && { column:      body.column }),
      ...(body.position    !== undefined && { position:    body.position }),
    },
    include: {
      assignee: { select: { id: true, name: true, email: true, imageUrl: true } },
      creator:  { select: { id: true, name: true, email: true, imageUrl: true } },
      _count:   { select: { comments: true, attachments: true } },
    },
  });

  // bump board updatedAt so other clients pick up change
  await db.kanbanBoard.update({
    where: { id: card.boardId },
    data:  { updatedAt: new Date() },
  });

  return NextResponse.json({ card });
}

// DELETE — delete card
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cardId } = await params;

  const card = await db.kanbanCard.findUnique({ where: { id: cardId } });
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.kanbanCard.delete({ where: { id: cardId } });
  await db.kanbanBoard.update({ where: { id: card.boardId }, data: { updatedAt: new Date() } });

  return NextResponse.json({ success: true });
}
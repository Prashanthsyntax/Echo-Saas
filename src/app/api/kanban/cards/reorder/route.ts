import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// POST — move card to new column + position
// body: { cardId, newColumn, newPosition, boardId }
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cardId, newColumn, newPosition, boardId } = await req.json();

  if (!cardId || !newColumn || newPosition === undefined || !boardId) {
    return NextResponse.json({ error: "cardId, newColumn, newPosition, boardId required" }, { status: 400 });
  }

  // shift other cards in the target column to make room
  await db.kanbanCard.updateMany({
    where: {
      boardId,
      column:   newColumn,
      position: { gte: newPosition },
      id:       { not: cardId },
    },
    data: { position: { increment: 1 } },
  });

  // move the card
  await db.kanbanCard.update({
    where: { id: cardId },
    data:  { column: newColumn, position: newPosition },
  });

  // bump board updatedAt
  await db.kanbanBoard.update({ where: { id: boardId }, data: { updatedAt: new Date() } });

  return NextResponse.json({ success: true });
}
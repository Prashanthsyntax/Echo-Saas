import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// POST — add comment to card
export async function POST(
  req: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cardId } = await params;
  const { content } = await req.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const comment = await db.kanbanComment.create({
    data: { cardId, content: content.trim(), userId: user.id },
    include: {
      user: { select: { id: true, name: true, email: true, imageUrl: true } },
    },
  });

  return NextResponse.json({ comment });
}

// DELETE — delete comment
export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { commentId } = await req.json();
  await db.kanbanComment.delete({ where: { id: commentId } });
  return NextResponse.json({ success: true });
}
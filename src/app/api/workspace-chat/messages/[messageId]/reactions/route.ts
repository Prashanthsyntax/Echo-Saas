import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messageId } = await params;
  const { emoji } = await req.json();

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const message = await db.message.findUnique({ where: { id: messageId } });
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // toggle reaction
  const existing = await db.messageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId: user.id, emoji } },
  });

  if (existing) {
    await db.messageReaction.delete({ where: { id: existing.id } });
    await pusherServer.trigger(
      CHANNELS.conversation(message.conversationId),
      EVENTS.REACTION_REMOVED,
      { messageId, emoji, userId: user.id }
    );
    return NextResponse.json({ action: "removed" });
  }

  await db.messageReaction.create({
    data: { messageId, userId: user.id, emoji },
  });

  await pusherServer.trigger(
    CHANNELS.conversation(message.conversationId),
    EVENTS.REACTION_ADDED,
    { messageId, emoji, userId: user.id, userName: user.name ?? user.email }
  );

  return NextResponse.json({ action: "added" });
}
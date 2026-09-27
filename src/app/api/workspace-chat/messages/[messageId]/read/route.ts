import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  const { messageId } = await params;

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ ok: false }, { status: 404 });

  const message = await db.message.findUnique({ where: { id: messageId } });
  if (!message) return NextResponse.json({ ok: false }, { status: 404 });

  await db.messageReadReceipt.upsert({
    where:  { messageId_userId: { messageId, userId: user.id } },
    update: { readAt: new Date() },
    create: { messageId, userId: user.id },
  });

  await pusherServer.trigger(
    CHANNELS.conversation(message.conversationId),
    EVENTS.READ_RECEIPT,
    { messageId, userId: user.id, readAt: new Date() }
  );

  return NextResponse.json({ ok: true });
}
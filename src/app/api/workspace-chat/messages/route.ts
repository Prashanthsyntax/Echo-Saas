/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";
import { NextResponse } from "next/server";

// POST — send a message
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    conversationId, content, type = "TEXT",
    parentId, metadata, poll,
    mentionedUserIds = [],
  } = await req.json();

  if (!conversationId || !content?.trim()) {
    return NextResponse.json({ error: "conversationId and content required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // verify participant
  const participant = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: user.id } },
  });
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true },
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // create message
  const message = await db.message.create({
    data: {
      conversationId,
      senderId: user.id,
      content:  content.trim(),
      type:     type as any,
      parentId: parentId ?? null,
      metadata: metadata ?? null,
      mentions: mentionedUserIds.length > 0 ? {
        create: mentionedUserIds.map((uid: string) => ({ userId: uid })),
      } : undefined,
      // create poll if provided
      ...(poll && type === "POLL" ? {
        poll: {
          create: {
            question:      poll.question,
            allowMultiple: poll.allowMultiple ?? false,
            endsAt:        poll.endsAt ? new Date(poll.endsAt) : null,
            options: {
              create: poll.options.map((o: string) => ({ text: o })),
            },
          },
        },
      } : {}),
    },
    include: {
      sender:    { select: { id: true, name: true, email: true, imageUrl: true } },
      reactions: { include: { user: { select: { id: true, name: true } } } },
      attachments: true,
      mentions:  { include: { user: { select: { id: true, name: true } } } },
      poll:      { include: { options: { include: { votes: { include: { user: { select: { id: true, name: true } } } } } } } },
      readReceipts: { include: { user: { select: { id: true, name: true, imageUrl: true } } } },
      _count:    { select: { replies: true } },
    },
  });

  // update conversation last message
  await db.conversation.update({
    where: { id: conversationId },
    data:  {
      lastMessageAt:     new Date(),
      lastMessagePreview:content.slice(0, 100),
    },
  });

  // increment unread for all other participants
  await db.conversationParticipant.updateMany({
    where: {
      conversationId,
      userId:    { not: user.id },
      isMuted:   false,
    },
    data: { unreadCount: { increment: 1 } },
  });

  // add sender's own read receipt
  await db.messageReadReceipt.create({
    data: { messageId: message.id, userId: user.id },
  });

  // Pusher — trigger to conversation channel
  await pusherServer.trigger(
    CHANNELS.conversation(conversationId),
    EVENTS.NEW_MESSAGE,
    { message }
  );

  // Pusher — notify workspace channel (for sidebar unread badges)
  const otherParticipantIds = conversation.participants
    .filter(p => p.userId !== user.id)
    .map(p => p.userId);

  await pusherServer.trigger(
    CHANNELS.workspace(conversation.workspaceId),
    EVENTS.CONVERSATION_UPDATED,
    {
      conversationId,
      lastMessagePreview: content.slice(0, 100),
      lastMessageAt:      new Date(),
      forUserIds:         otherParticipantIds,
      unreadIncrement:    true,
    }
  );

  return NextResponse.json({ message });
}
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

  const user = await db.user.findUnique({
    where:  { clerkId: userId },
    select: { id: true, name: true, email: true, imageUrl: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // verify participant
  const participant = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: user.id } },
    select: { id: true },
  });
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // validate parentId belongs to same conversation
  if (parentId) {
    const parent = await db.message.findUnique({
      where:  { id: parentId },
      select: { conversationId: true },
    });
    if (!parent || parent.conversationId !== conversationId) {
      return NextResponse.json({ error: "Invalid parentId" }, { status: 400 });
    }
  }

  const conversation = await db.conversation.findUnique({
    where:  { id: conversationId },
    select: { id: true, workspaceId: true, participants: { select: { userId: true, isMuted: true } } },
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // create message
  const message = await db.message.create({
    data: {
      conversationId,
      senderId:  user.id,
      content:   content.trim(),
      type:      type as any,
      parentId:  parentId ?? null,
      metadata:  metadata ?? null,
      ...(mentionedUserIds.length > 0 ? {
        mentions: { create: mentionedUserIds.map((uid: string) => ({ userId: uid })) },
      } : {}),
      ...(poll && type === "POLL" ? {
        poll: {
          create: {
            question:      poll.question,
            allowMultiple: poll.allowMultiple ?? false,
            endsAt:        poll.endsAt ? new Date(poll.endsAt) : null,
            options:       { create: poll.options.map((o: string) => ({ text: o })) },
          },
        },
      } : {}),
    },
    select: {
      id: true, content: true, type: true,
      senderId: true, conversationId: true,
      parentId: true, isEdited: true,
      isDeleted: true, metadata: true, createdAt: true,
      sender:    { select: { id: true, name: true, email: true, imageUrl: true } },
      reactions: { select: { emoji: true, user: { select: { id: true, name: true } } } },
      attachments: { select: { id: true, name: true, url: true, size: true, mimeType: true } },
      readReceipts:{ select: { userId: true, readAt: true,
        user: { select: { id: true, name: true, imageUrl: true } } } },
      mentions:  { select: { user: { select: { id: true, name: true } } } },
      poll: {
        select: {
          id: true, question: true, allowMultiple: true, endsAt: true,
          options: { select: { id: true, text: true,
            votes: { select: { user: { select: { id: true, name: true } } } } } },
        },
      },
      _count: { select: { replies: true } },
    },
  });

  // add own read receipt async
  db.messageReadReceipt.create({
    data: { messageId: message.id, userId: user.id },
  }).catch(() => {});

  // update conversation preview (only for top-level messages)
  if (!parentId) {
    db.conversation.update({
      where: { id: conversationId },
      data:  { lastMessageAt: new Date(), lastMessagePreview: content.slice(0, 100) },
    }).catch(() => {});

    // increment unread for other non-muted participants async
    db.conversationParticipant.updateMany({
      where: { conversationId, userId: { not: user.id }, isMuted: false },
      data:  { unreadCount: { increment: 1 } },
    }).catch(() => {});
  }

  // Pusher — conversation channel
  await pusherServer.trigger(
    CHANNELS.conversation(conversationId),
    EVENTS.NEW_MESSAGE,
    { message }
  );

  // Pusher — workspace channel for sidebar unread badges (only top-level)
  if (!parentId) {
    const otherIds = conversation.participants
      .filter(p => p.userId !== user.id)
      .map(p => p.userId);

    pusherServer.trigger(
      CHANNELS.workspace(conversation.workspaceId),
      EVENTS.CONVERSATION_UPDATED,
      {
        conversationId,
        lastMessagePreview: content.slice(0, 100),
        lastMessageAt:      new Date().toISOString(),
        forUserIds:         otherIds,
        unreadIncrement:    true,
      }
    ).catch(() => {});
  }

  return NextResponse.json({ message });
}
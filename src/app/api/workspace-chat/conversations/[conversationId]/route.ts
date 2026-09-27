import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";
import { NextResponse } from "next/server";

// GET — fetch full conversation with messages
export async function GET(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await params;
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // verify participant fast
  const participant = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: user.id } },
    select: {
      isStarred: true,
      isMuted: true,
      unreadCount: true,
      lastReadAt: true,
    },
  });
  if (!participant)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // fetch conversation + participants in one query
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      subject: true,
      isGroup: true,
      status: true,
      creatorId: true,
      participants: {
        select: {
          userId: true,
          user: {
            select: { id: true, name: true, email: true, imageUrl: true },
          },
        },
      },
    },
  });
  if (!conversation)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // fetch only top-level messages (parentId null) — fast
  const messages = await db.message.findMany({
    where: {
      conversationId,
      isDeleted: false,
      parentId: null,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    select: {
      id: true,
      content: true,
      type: true,
      senderId: true,
      conversationId: true,
      parentId: true,
      isEdited: true,
      isDeleted: true,
      metadata: true,
      createdAt: true,
      sender: { select: { id: true, name: true, email: true, imageUrl: true } },
      reactions: {
        select: { emoji: true, user: { select: { id: true, name: true } } },
      },
      attachments: {
        select: { id: true, name: true, url: true, size: true, mimeType: true },
      },
      readReceipts: {
        select: {
          userId: true,
          readAt: true,
          user: { select: { id: true, name: true, imageUrl: true } },
        },
      },
      mentions: { select: { user: { select: { id: true, name: true } } } },
      poll: {
        select: {
          id: true,
          question: true,
          allowMultiple: true,
          endsAt: true,
          options: {
            select: {
              id: true,
              text: true,
              votes: { select: { user: { select: { id: true, name: true } } } },
            },
          },
        },
      },
      _count: { select: { replies: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  // mark conversation as read async (don't await)
  db.conversationParticipant
    .update({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      data: { lastReadAt: new Date(), unreadCount: 0 },
    })
    .catch(() => {});

  // bulk insert read receipts async (don't await — don't block response)
  const unreadIds = messages
    .filter((m) => !m.readReceipts.some((r) => r.userId === user.id))
    .map((m) => m.id);

  if (unreadIds.length > 0) {
    db.messageReadReceipt
      .createMany({
        data: unreadIds.map((messageId) => ({ messageId, userId: user.id })),
        skipDuplicates: true,
      })
      .catch(() => {});
  }

  return NextResponse.json({
    conversation,
    messages: messages.reverse(),
    hasMore: messages.length === 30,
    nextCursor:
      messages.length === 30 ? messages[0]?.createdAt.toISOString() : null,
    myParticipant: participant,
  });
}

// PATCH — star, archive, mute conversation
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await params;
  const body = await req.json();

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // update participant settings
  if ("isStarred" in body || "isMuted" in body) {
    await db.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: user.id } },
      data: {
        ...(body.isStarred !== undefined && { isStarred: body.isStarred }),
        ...(body.isMuted !== undefined && { isMuted: body.isMuted }),
      },
    });
  }

  // archive/unarchive
  if ("status" in body) {
    await db.conversation.update({
      where: { id: conversationId },
      data: { status: body.status },
    });
  }

  return NextResponse.json({ success: true });
}

// DELETE — delete an entire conversation.
// - If the requester created it: hard-deletes the Conversation row.
//   Prisma's onDelete: Cascade on ConversationParticipant, Message, etc.
//   (all defined with `onDelete: Cascade` back to Conversation) removes
//   every related row automatically — nothing else to clean up by hand.
// - If the requester is just a participant (not the creator): they are
//   removed from the conversation instead. The conversation itself, and
//   everyone else's copy of it, is left untouched — it simply stops
//   appearing in the requester's own Inbox/Sent/Starred/Archived lists.
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await params;

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      creatorId: true,
      workspaceId: true,
      participants: { select: { userId: true } },
    },
  });
  if (!conversation)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isParticipant = conversation.participants.some(
    (p) => p.userId === user.id,
  );
  if (!isParticipant)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (conversation.creatorId === user.id) {
    const remainingUserIds = conversation.participants.map((p) => p.userId);

    await db.conversation.delete({ where: { id: conversationId } });

    // let everyone else's open tab drop it from their list / close the
    // thread in real time (requires a matching listener on the
    // workspace channel client-side — see CONVERSATION_DELETED note).
    await pusherServer.trigger(
      CHANNELS.workspace(conversation.workspaceId),
      EVENTS.CONVERSATION_DELETED,
      { conversationId, forUserIds: remainingUserIds },
    );

    return NextResponse.json({ success: true, deletedFor: "everyone" });
  }

  // not the creator — just leave the conversation
  await db.conversationParticipant.delete({
    where: { conversationId_userId: { conversationId, userId: user.id } },
  });

  return NextResponse.json({ success: true, deletedFor: "self" });
}

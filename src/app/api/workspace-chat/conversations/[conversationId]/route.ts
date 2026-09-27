import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";
import { NextResponse } from "next/server";

// GET — fetch full conversation with messages
export async function GET(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await params;
  const { searchParams }   = new URL(req.url);
  const cursor             = searchParams.get("cursor"); // for pagination

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // verify participant
  const participant = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: user.id } },
  });
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, email: true, imageUrl: true } },
        },
      },
    },
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // paginated messages — newest first, then reversed for display
  const messages = await db.message.findMany({
    where: {
      conversationId,
      isDeleted: false,
      parentId:  null, // only top-level messages; replies fetched per-message
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    include: {
      sender: { select: { id: true, name: true, email: true, imageUrl: true } },
      reactions: {
        include: { user: { select: { id: true, name: true } } },
      },
      attachments: true,
      readReceipts: {
        include: { user: { select: { id: true, name: true, imageUrl: true } } },
      },
      mentions: {
        include: { user: { select: { id: true, name: true } } },
      },
      poll: {
        include: {
          options: {
            include: { votes: { include: { user: { select: { id: true, name: true } } } } },
          },
        },
      },
      replies: {
        where:   { isDeleted: false },
        include: {
          sender: { select: { id: true, name: true, email: true, imageUrl: true } },
          reactions: { include: { user: { select: { id: true, name: true } } } },
          attachments: true,
        },
        orderBy: { createdAt: "asc" },
        take:    3,
      },
      _count: { select: { replies: true } },
    },
    orderBy: { createdAt: "desc" },
    take:    30,
  });

  // mark all as read
  await db.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: user.id } },
    data:  { lastReadAt: new Date(), unreadCount: 0 },
  });

  // bulk upsert read receipts for unread messages
  const unread = messages.filter(
    m => !m.readReceipts.some(r => r.userId === user.id)
  );
  if (unread.length > 0) {
    await db.messageReadReceipt.createMany({
      data: unread.map(m => ({ messageId: m.id, userId: user.id })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json({
    conversation,
    messages:  messages.reverse(), // chronological order
    hasMore:   messages.length === 30,
    nextCursor:messages.length === 30 ? messages[0].createdAt.toISOString() : null,
    myParticipant: participant,
  });
}

// PATCH — star, archive, mute conversation
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
        ...(body.isMuted   !== undefined && { isMuted:   body.isMuted   }),
      },
    });
  }

  // archive/unarchive
  if ("status" in body) {
    await db.conversation.update({
      where: { id: conversationId },
      data:  { status: body.status },
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
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isParticipant = conversation.participants.some(p => p.userId === user.id);
  if (!isParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (conversation.creatorId === user.id) {
    const remainingUserIds = conversation.participants.map(p => p.userId);

    await db.conversation.delete({ where: { id: conversationId } });

    // let everyone else's open tab drop it from their list / close the
    // thread in real time (requires a matching listener on the
    // workspace channel client-side — see CONVERSATION_DELETED note).
    await pusherServer.trigger(
      CHANNELS.workspace(conversation.workspaceId),
      EVENTS.CONVERSATION_DELETED,
      { conversationId, forUserIds: remainingUserIds }
    );

    return NextResponse.json({ success: true, deletedFor: "everyone" });
  }

  // not the creator — just leave the conversation
  await db.conversationParticipant.delete({
    where: { conversationId_userId: { conversationId, userId: user.id } },
  });

  return NextResponse.json({ success: true, deletedFor: "self" });
}
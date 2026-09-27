/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";
import { NextResponse } from "next/server";

// GET — list conversations for current user in workspace
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  const filter = searchParams.get("filter") ?? "inbox";

  if (!workspaceId)
    return NextResponse.json(
      { error: "workspaceId required" },
      { status: 400 },
    );

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // single optimized query — no nested message fetches
  const participants = await db.conversationParticipant.findMany({
    where: {
      userId: user.id,
      conversation: {
        workspaceId,
        ...(filter === "archived"
          ? { status: "ARCHIVED" }
          : { status: "ACTIVE" }),
        ...(filter === "sent" ? { creatorId: user.id } : {}),
      },
      ...(filter === "starred" ? { isStarred: true } : {}),
    },
    select: {
      isStarred: true,
      isMuted: true,
      unreadCount: true,
      lastReadAt: true,
      conversation: {
        select: {
          id: true,
          subject: true,
          isGroup: true,
          status: true,
          lastMessageAt: true,
          lastMessagePreview: true,
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
      },
    },
    orderBy: { conversation: { lastMessageAt: "desc" } },
    take: 40,
  });

  const conversations = participants.map((p) => ({
    ...p.conversation,
    myParticipant: {
      isStarred: p.isStarred,
      isMuted: p.isMuted,
      unreadCount: p.unreadCount,
      lastReadAt: p.lastReadAt,
    },
  }));

  return NextResponse.json({ conversations });
}

// POST — create new conversation
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    workspaceId,
    subject,
    participantIds = [],
    isGroup = false,
    initialMessage,
  } = await req.json();

  if (!workspaceId || !subject?.trim() || !initialMessage?.trim()) {
    return NextResponse.json(
      { error: "workspaceId, subject, initialMessage required" },
      { status: 400 },
    );
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // verify sender is workspace member
  const membership = await db.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });
  if (!membership)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // verify all participants are workspace members
  const allParticipantIds = [...new Set([user.id, ...participantIds])];
  const validMembers = await db.membership.findMany({
    where: { workspaceId, userId: { in: allParticipantIds } },
  });
  if (validMembers.length !== allParticipantIds.length) {
    return NextResponse.json(
      { error: "Some participants are not workspace members" },
      { status: 400 },
    );
  }

  const conversation = await db.conversation.create({
    data: {
      workspaceId,
      subject: subject.trim(),
      isGroup,
      creatorId: user.id,
      lastMessageAt: new Date(),
      lastMessagePreview: initialMessage.slice(0, 100),
      participants: {
        create: allParticipantIds.map((uid) => ({
          userId: uid,
          unreadCount: uid === user.id ? 0 : 1,
        })),
      },
      messages: {
        create: {
          content: initialMessage.trim(),
          senderId: user.id,
          type: "TEXT",
        },
      },
    },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, name: true, email: true, imageUrl: true },
          },
        },
      },
      messages: {
        take: 1,
        include: {
          sender: {
            select: { id: true, name: true, email: true, imageUrl: true },
          },
        },
      },
    },
  });

  // notify all participants via Pusher
  await pusherServer.trigger(
    CHANNELS.workspace(workspaceId),
    EVENTS.NEW_CONVERSATION,
    {
      conversation,
      forUserIds: allParticipantIds,
    },
  );

  return NextResponse.json({ conversation });
}

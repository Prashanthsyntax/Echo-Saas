import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";
import { NextResponse } from "next/server";

// PATCH — edit message
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messageId } = await params;
  const { content } = await req.json();

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const message = await db.message.findUnique({
    where: { id: messageId },
    include: { conversation: { select: { workspaceId: true } } },
  });
  if (!message || message.senderId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await db.message.update({
    where: { id: messageId },
    data:  { content: content.trim(), isEdited: true, editedAt: new Date() },
    include: {
      sender: { select: { id: true, name: true, email: true, imageUrl: true } },
      reactions: { include: { user: { select: { id: true, name: true } } } },
      attachments: true,
      _count: { select: { replies: true } },
    },
  });

  await pusherServer.trigger(
    CHANNELS.conversation(message.conversationId),
    EVENTS.MESSAGE_UPDATED,
    { message: updated }
  );

  return NextResponse.json({ message: updated });
}

// DELETE — soft delete
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { messageId } = await params;

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const message = await db.message.findUnique({ where: { id: messageId } });
  if (!message || message.senderId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.message.update({
    where: { id: messageId },
    data:  { isDeleted: true, content: "This message was deleted" },
  });

  await pusherServer.trigger(
    CHANNELS.conversation(message.conversationId),
    EVENTS.MESSAGE_DELETED,
    { messageId }
  );

  return NextResponse.json({ success: true });
}
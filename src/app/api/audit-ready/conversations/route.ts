import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET — list all conversations for workspace
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  const conversations = await db.auditConversation.findMany({
    where:   { workspaceId },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take:    1,
        select:  { content: true, role: true, createdAt: true },
      },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
    take:    50,
  });

  return NextResponse.json({ conversations });
}

// DELETE — delete a conversation
export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await req.json();
  await db.auditConversation.delete({ where: { id: conversationId } });
  return NextResponse.json({ success: true });
}
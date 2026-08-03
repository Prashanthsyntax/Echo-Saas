import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET — load existing session + all messages for current workspace
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ session: null, messages: [] });

  const session = await db.chatSession.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!session) return NextResponse.json({ session: null, messages: [] });

  return NextResponse.json({
    session: { id: session.id },
    messages: session.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      sources: m.sources,
      modelUsed: m.modelUsed,
      contextUsed: m.contextUsed,
      chunkIds: m.chunkIds,
      feedback: m.feedback,
      createdAt: m.createdAt,
    })),
  });
}

// POST — create session if not exists, return sessionId
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await req.json();
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const session = await db.chatSession.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
    update: { updatedAt: new Date() },
    create: { userId: user.id, workspaceId },
  });

  return NextResponse.json({ sessionId: session.id });
}

// DELETE — clear all messages for current workspace session
export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await req.json();

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await db.chatSession.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });

  if (session) {
    await db.chatMessage.deleteMany({ where: { sessionId: session.id } });
  }

  return NextResponse.json({ success: true });
}
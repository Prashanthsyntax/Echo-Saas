import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET — load workspace shared session
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

  // verify membership
  const membership = await db.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // find user's session for this workspace
  const session = await db.chatSession.findFirst({
    where: { workspaceId, userId: user.id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          // include sender info for shared chat
          session: {
            include: {
              user: {
                select: { id: true, name: true, imageUrl: true },
              },
            },
          },
        },
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

// POST — get or create workspace shared session
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

  const membership = await db.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // find existing user session or create one
  let session = await db.chatSession.findFirst({
    where: { workspaceId, userId: user.id },
  });

  if (!session) {
    session = await db.chatSession.create({
      data: { userId: user.id, workspaceId },
    });
  }

  return NextResponse.json({ sessionId: session.id });
}

// DELETE — clear workspace chat (OWNER/ADMIN only)
export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId } = await req.json();
  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // only OWNER/ADMIN can clear workspace chat
  const membership = await db.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });

  if (!membership || membership.role === "EDITOR" || membership.role === "VIEWER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await db.chatSession.findFirst({ where: { workspaceId, userId: user.id } });
  if (session) {
    await db.chatMessage.deleteMany({ where: { sessionId: session.id } });
  }

  return NextResponse.json({ success: true });
}
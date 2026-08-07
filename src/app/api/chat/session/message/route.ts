import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireWorkspaceMembership } from "@/lib/workspace-auth";

async function authorizeSession(sessionId: string) {
  const session = await db.chatSession.findUnique({
    where: { id: sessionId },
    select: { workspaceId: true },
  });

  if (!session) {
    return { ok: false as const, status: 404, error: "Session not found" };
  }

  const result = await requireWorkspaceMembership(session.workspaceId);
  if (!result.ok) {
    return result;
  }

  return { ok: true as const, workspaceId: session.workspaceId };
}

// POST — save a single message to the session
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    sessionId,
    role,
    content,
    sources = [],
    modelUsed = null,
    contextUsed = false,
    chunkIds = [],
  } = await req.json();

  if (!sessionId || !role || !content) {
    return NextResponse.json(
      { error: "sessionId, role, content required" },
      { status: 400 }
    );
  }

  if (!["user", "assistant"].includes(role)) {
    return NextResponse.json({ error: "Invalid message role" }, { status: 400 });
  }

  const sessionAuth = await authorizeSession(sessionId);
  if (!sessionAuth.ok) {
    return NextResponse.json(
      { error: sessionAuth.error },
      { status: sessionAuth.status }
    );
  }

  const message = await db.chatMessage.create({
    data: {
      sessionId,
      role,
      content,
      sources,
      modelUsed,
      contextUsed,
      chunkIds,
    },
  });

  return NextResponse.json({ messageId: message.id });
}

// PATCH — update feedback on an existing message
export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messageId, feedback } = await req.json();

  if (!messageId || feedback === undefined) {
    return NextResponse.json(
      { error: "messageId and feedback required" },
      { status: 400 }
    );
  }

  const message = await db.chatMessage.findUnique({
    where: { id: messageId },
    select: { sessionId: true },
  });

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const sessionAuth = await authorizeSession(message.sessionId);
  if (!sessionAuth.ok) {
    return NextResponse.json(
      { error: sessionAuth.error },
      { status: sessionAuth.status }
    );
  }

  await db.chatMessage.update({
    where: { id: messageId },
    data: { feedback },
  });

  return NextResponse.json({ success: true });
}

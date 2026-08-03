import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

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

  await db.chatMessage.update({
    where: { id: messageId },
    data: { feedback },
  });

  return NextResponse.json({ success: true });
}
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET — load all messages for a conversation
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await params;

  const conversation = await db.auditConversation.findUnique({
    where:   { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id:                   true,
          role:                 true,
          content:              true,
          memoriesUsed:         true,
          controlsReferenced:   true,
          interactionNumber:    true,
          createdAt:            true,
        },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ conversation });
}
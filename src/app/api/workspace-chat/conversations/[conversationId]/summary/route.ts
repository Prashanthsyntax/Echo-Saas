import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { groq } from "@/lib/groq";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";
import { NextResponse } from "next/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId } = await params;

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const participant = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: user.id } },
  });
  if (!participant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // fetch last 50 messages
  const messages = await db.message.findMany({
    where:   { conversationId, isDeleted: false, parentId: null },
    include: { sender: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take:    50,
  });

  const transcript = messages
    .reverse()
    .map(m => `${m.sender.name ?? m.sender.email}: ${m.content}`)
    .join("\n");

  const conversation = await db.conversation.findUnique({ where: { id: conversationId } });

  const res = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      {
        role:    "system",
        content: "You are a workspace assistant that summarises conversations concisely. Extract: key decisions made, action items, open questions, and a 2-3 sentence overview.",
      },
      {
        role:    "user",
        content: `Summarise this conversation titled "${conversation?.subject}":\n\n${transcript}`,
      },
    ],
    temperature: 0.3,
    max_tokens:  600,
  });

  const summary = res.choices[0]?.message?.content ?? "Could not generate summary.";

  // push summary to all participants in real-time
  await pusherServer.trigger(
    CHANNELS.conversation(conversationId),
    EVENTS.AI_SUMMARY_READY,
    { summary, requestedBy: user.name ?? user.email }
  );

  return NextResponse.json({ summary });
}
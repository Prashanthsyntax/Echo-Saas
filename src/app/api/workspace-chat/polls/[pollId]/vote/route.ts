import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { pusherServer, CHANNELS, EVENTS } from "@/lib/pusher";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ pollId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pollId }   = await params;
  const { optionIds } = await req.json(); // array for multi-select

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const poll = await db.poll.findUnique({
    where:   { id: pollId },
    include: { options: true, message: { select: { conversationId: true } } },
  });
  if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // remove existing votes
  await db.pollVote.deleteMany({
    where: {
      option:  { pollId },
      userId: user.id,
    },
  });

  // add new votes
  const ids = poll.allowMultiple ? optionIds : [optionIds[0]];
  await db.pollVote.createMany({
    data: ids.map((optionId: string) => ({ optionId, userId: user.id })),
  });

  // fetch updated poll
  const updated = await db.poll.findUnique({
    where:   { id: pollId },
    include: {
      options: { include: { votes: { include: { user: { select: { id: true, name: true } } } } } },
    },
  });

  await pusherServer.trigger(
    CHANNELS.conversation(poll.message.conversationId),
    EVENTS.POLL_VOTE,
    { pollId, updated }
  );

  return NextResponse.json({ poll: updated });
}
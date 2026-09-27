import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { pusherServer } from "@/lib/pusher";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body        = await req.text();
  const params      = new URLSearchParams(body);
  const socketId    = params.get("socket_id")!;
  const channelName = params.get("channel_name")!;

  // presence channel auth — verify user is participant
  if (channelName.startsWith("presence-conv-")) {
    const conversationId = channelName.replace("presence-conv-", "");

    const participant = await db.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId, userId: user.id },
      },
    });

    if (!participant) {
      return NextResponse.json({ error: "Not a participant" }, { status: 403 });
    }

    const presenceData = {
      user_id:   user.id,
      user_info: {
        name:     user.name ?? user.email,
        email:    user.email,
        imageUrl: user.imageUrl,
      },
    };

    const authResponse = pusherServer.authorizeChannel(socketId, channelName, presenceData);
    return NextResponse.json(authResponse);
  }

  // private channel auth
  const authResponse = pusherServer.authorizeChannel(socketId, channelName);
  return NextResponse.json(authResponse);
}
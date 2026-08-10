import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// Full-text search across video titles, notes, transcripts, summaries
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q")?.trim();
  const workspaceId = searchParams.get("workspaceId");

  if (!query || !workspaceId) {
    return NextResponse.json({ results: [] });
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ results: [] });

  // verify membership
  const membership = await db.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });
  if (!membership) return NextResponse.json({ results: [] });

  // search across title, summary, transcript, structured notes
  const videos = await db.video.findMany({
    where: {
      workspaceId,
      status: "READY",
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { summary: { contains: query, mode: "insensitive" } },
        { transcript: { contains: query, mode: "insensitive" } },
        { structuredNotes: { contains: query, mode: "insensitive" } },
        { topics: { has: query.toLowerCase() } },
      ],
    },
    select: {
      id: true,
      title: true,
      summary: true,
      topics: true,
      keyPoints: true,
      language: true,
      createdAt: true,
      user: { select: { name: true, imageUrl: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({ results: videos });
}
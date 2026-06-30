import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { createHash } from "crypto";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { question, answer, sources, rating, chunkIds, modelUsed } =
    await req.json();

  if (!question || !answer || rating === undefined) {
    return NextResponse.json(
      { error: "question, answer, and rating required" },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // 1. store raw feedback
  await db.ragFeedback.create({
    data: {
      userId: user.id,
      question,
      answer,
      sources: sources ?? [],
      rating,
      chunkIds: chunkIds ?? [],
      modelUsed: modelUsed ?? "echo-nemo-1.0",
    },
  });

  // 2. update chunk scores per source
  if (sources && sources.length > 0) {
    const delta = rating === 1 ? 0.5 : -0.3;
    const chunkKey = answer.slice(0, 100);
    const chunkHash = createHash("sha256").update(chunkKey).digest("hex");

    for (const source of sources) {
      await db.chunkScore.upsert({
        where: {
          userId_sourceDoc_chunkHash: {
            userId: user.id,
            sourceDoc: source,
            chunkHash,
          },
        },
        update: {
          score: { increment: delta },
          usageCount: { increment: 1 },
        },
        create: {
          userId: user.id,
          sourceDoc: source,
          chunkText: chunkKey,
          chunkHash,
          score: delta,
          usageCount: 1,
        },
      });
    }
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ feedback: [], stats: null });

  const [feedback, stats, topSources] = await Promise.all([
    db.ragFeedback.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.ragFeedback.aggregate({
      where: { userId: user.id },
      _count: { id: true },
      _avg: { rating: true },
    }),
    db.chunkScore.findMany({
      where: { userId: user.id },
      orderBy: { score: "desc" },
      take: 10,
    }),
  ]);

  const [thumbsUp, thumbsDown] = await Promise.all([
    db.ragFeedback.count({ where: { userId: user.id, rating: 1 } }),
    db.ragFeedback.count({ where: { userId: user.id, rating: -1 } }),
  ]);

  return NextResponse.json({
    feedback,
    stats: {
      total: stats._count.id,
      thumbsUp,
      thumbsDown,
      avgRating: stats._avg.rating ?? 0,
      accuracyPercent:
        stats._count.id > 0
          ? Math.round((thumbsUp / stats._count.id) * 100)
          : null,
    },
    topSources,
  });
}
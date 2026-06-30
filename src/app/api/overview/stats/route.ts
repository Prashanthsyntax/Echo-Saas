import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    return NextResponse.json({
      videos: 0,
      comments: 0,
      workspaces: 0,
      views: 0,
      transcripts: 0,
      folders: 0,
    });
  }

  const workspaceFilter = workspaceId ? { workspaceId } : { userId: user.id };

  const [videos, comments, workspaces, views, transcripts, folders] =
    await Promise.all([
      db.video.count({ where: workspaceFilter }),
      db.comment.count({ where: { userId: user.id } }),
      db.membership.count({ where: { userId: user.id } }),
      db.video.aggregate({
        where: workspaceFilter,
        _sum: { viewCount: true },
      }),
      db.video.count({
        where: { ...workspaceFilter, transcript: { not: null } },
      }),
      db.folder.count({
        where: workspaceId
          ? { workspaceId }
          : { workspace: { memberships: { some: { userId: user.id } } } },
      }),
    ]);

  // add to the Promise.all:
const ragStats = await db.ragFeedback.aggregate({
  where: { userId: user.id },
  _count: { id: true },
  _avg: { rating: true },
});

const thumbsUp = await db.ragFeedback.count({
  where: { userId: user.id, rating: 1 },
});

  return NextResponse.json({
    videos,
    comments,
    workspaces,
    views: views._sum.viewCount ?? 0,
    transcripts,
    folders,
    ragQueries: ragStats._count.id ?? 0,
    ragAccuracy:
      ragStats._count.id > 0
        ? Math.round((thumbsUp / ragStats._count.id) * 100)
        : null,
  });
}

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireWorkspaceMembership } from "@/lib/workspace-auth";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");

  if (workspaceId) {
    const result = await requireWorkspaceMembership(workspaceId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
  }

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

  // when no specific workspace selected, show stats across ALL user workspaces
  const userWorkspaces = workspaceId
    ? null
    : await db.membership.findMany({
        where: { userId: user.id },
        select: { workspaceId: true },
      });

  const workspaceFilter = workspaceId
    ? { workspaceId }
    : { workspaceId: { in: userWorkspaces!.map((m) => m.workspaceId) } };

  // run ALL queries in parallel — including ragStats
  const [videos, comments, workspaces, views, transcripts, folders, ragStats, thumbsUp] =
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
      db.ragFeedback.aggregate({
        where: { userId: user.id },
        _count: { id: true },
        _avg: { rating: true },
      }),
      db.ragFeedback.count({
        where: { userId: user.id, rating: 1 },
      }),
    ]);

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

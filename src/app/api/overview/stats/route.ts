import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const [videos, comments, workspaces, views, transcripts, folders] =
    await Promise.all([
      db.video.count({ where: { userId: user.id } }),
      db.comment.count({ where: { userId: user.id } }),
      db.membership.count({ where: { userId: user.id } }),
      db.video.aggregate({
        where: { userId: user.id },
        _sum: { viewCount: true },
      }),
      db.video.count({
        where: { userId: user.id, transcript: { not: null } },
      }),
      db.folder.count({
        where: { workspace: { memberships: { some: { userId: user.id } } } },
      }),
    ]);

  return NextResponse.json({
    videos,
    comments,
    workspaces,
    views: views._sum.viewCount ?? 0,
    transcripts,
    folders,
  });
}
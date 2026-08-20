import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireWorkspacePermission } from "@/lib/workspace-auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;

  const result = await requireWorkspacePermission(workspaceId, "VIEW_MEMBERS");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const cursor = searchParams.get("cursor") ?? undefined;

  const activities = await db.activityLog.findMany({
    where: { workspaceId },
    include: {
      user: {
        select: { id: true, name: true, email: true, imageUrl: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = activities.length > limit;
  const items = hasMore ? activities.slice(0, limit) : activities;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return NextResponse.json({ activities: items, nextCursor, hasMore });
}
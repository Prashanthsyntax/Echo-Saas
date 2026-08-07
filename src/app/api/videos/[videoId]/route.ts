import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { supabase, STORAGE_BUCKET } from "@/lib/storage";
import { NextResponse } from "next/server";
import { requireVideoPermission } from "@/lib/workspace-auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { videoId } = await params;
  const body = await req.json();
  const { status, url, duration, title } = body;

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const video = await db.video.update({
    where: { id: videoId, userId: user.id },
    data: {
      ...(status !== undefined && { status }),
      ...(url !== undefined && { url }),
      ...(duration !== undefined && { duration }),
      ...(title !== undefined && { title }),
    },
  });

  return NextResponse.json(video);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;

  const result = await requireVideoPermission(videoId, "VIEW_VIDEO");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const video = await db.video.findUnique({
    where: { id: videoId },
    include: { user: true },
  });

  if (!video) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(video);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { videoId } = await params;

  const access = await requireVideoPermission(videoId, "DELETE_VIDEO");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const video = await db.video.findUnique({
    where: { id: videoId },
  });

  if (!video) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // delete from Supabase storage
  if (video.url) {
    const path = video.url.split(`/object/public/${STORAGE_BUCKET}/`)[1];
    if (path) {
      await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    }
  }

  // delete from database
  await db.video.delete({ where: { id: videoId } });

  return NextResponse.json({ success: true });
}

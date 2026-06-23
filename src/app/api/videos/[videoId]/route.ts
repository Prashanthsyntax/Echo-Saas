import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { supabase, STORAGE_BUCKET } from "@/lib/storage";
import { NextResponse } from "next/server";

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
      ...(status && { status }),
      ...(url && { url }),
      ...(duration && { duration }),
      ...(title && { title }),
    },
  });

  return NextResponse.json(video);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;

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

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const video = await db.video.findUnique({
    where: { id: videoId, userId: user.id },
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
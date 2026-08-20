import { auth } from "@clerk/nextjs/server";
import { supabase, STORAGE_BUCKET, getPublicUrl } from "@/lib/storage";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireWorkspacePermission } from "@/lib/workspace-auth";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename, contentType, fileData, duration, workspaceId } = await req.json();

  if (!filename || !contentType || !fileData || !workspaceId) {
    return NextResponse.json(
      { error: "Missing filename, contentType, fileData, or workspaceId" },
      { status: 400 }
    );
  }

  if (!contentType.startsWith("video/")) {
    return NextResponse.json(
      { error: "Invalid content type - must be a video" },
      { status: 400 }
    );
  }

  const access = await requireWorkspacePermission(workspaceId, "UPLOAD_VIDEO");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const video = await db.video.create({
    data: {
      title: "Untitled Video",
      status: "UPLOADING",
      userId: access.user.id,
      workspaceId,
    },
  });

  const base64 = fileData.split(",")[1] ?? fileData;
  const buffer = Buffer.from(base64, "base64");

  if (buffer.length < 1024) {
    await db.video.update({
      where: { id: video.id },
      data: { status: "FAILED" },
    });
    return NextResponse.json(
      { error: "Recording is too small to upload" },
      { status: 400 }
    );
  }

  const path = `${video.id}/${filename}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    await db.video.update({
      where: { id: video.id },
      data: { status: "FAILED" },
    });
    console.error("Supabase upload error:", uploadError);
    return NextResponse.json(
      { error: "Storage upload failed", detail: uploadError.message },
      { status: 500 }
    );
  }

  const publicUrl = getPublicUrl(path);

  await db.video.update({
    where: { id: video.id },
    data: {
      status: "READY",
      url: publicUrl,
      duration: typeof duration === "number" ? duration : null,
    },
  });

  console.log("Video uploaded:", video.id, publicUrl);

  return NextResponse.json({ videoId: video.id, publicUrl });
}

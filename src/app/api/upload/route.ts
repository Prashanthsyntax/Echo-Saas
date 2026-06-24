import { auth, currentUser } from "@clerk/nextjs/server";
import { supabase, STORAGE_BUCKET, getPublicUrl } from "@/lib/storage";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename, contentType, fileData, duration } = await req.json();

  if (!filename || !contentType || !fileData) {
    return NextResponse.json(
      { error: "Missing filename, contentType, or fileData" },
      { status: 400 }
    );
  }

  if (!contentType.startsWith("video/")) {
    return NextResponse.json(
      { error: "Invalid content type — must be a video" },
      { status: 400 }
    );
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // find or create user — resilient to webhook not having fired yet
  let user = await db.user.findUnique({ where: { clerkId: userId } });

  if (!user) {
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      return NextResponse.json(
        { error: "No email on Clerk user" },
        { status: 400 }
      );
    }
    user = await db.user.create({
      data: {
        clerkId: userId,
        email,
        name:
          [clerkUser.firstName, clerkUser.lastName]
            .filter(Boolean)
            .join(" ") || null,
        imageUrl: clerkUser.imageUrl,
      },
    });
    console.log("Created user inline (webhook fallback):", user.id);
  }

  // find or create default workspace
  let workspace = await db.workspace.findFirst({
    where: { memberships: { some: { userId: user.id } } },
  });

  if (!workspace) {
    workspace = await db.workspace.create({
      data: {
        name: `${user.name ?? user.email}'s Workspace`,
        memberships: {
          create: { userId: user.id, role: "OWNER" },
        },
      },
    });
    console.log("Created workspace inline:", workspace.id);
  }

  // create video row with UPLOADING status
  const video = await db.video.create({
    data: {
      title: "Untitled Video",
      status: "UPLOADING",
      userId: user.id,
      workspaceId: workspace.id,
    },
  });

  // convert base64 to buffer
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

  // upload to Supabase storage
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

  // mark video as READY with duration
  await db.video.update({
    where: { id: video.id },
    data: {
      status: "READY",
      url: publicUrl,
      duration: typeof duration === "number" ? duration : null,
    },
  });

  console.log("✅ Video uploaded:", video.id, publicUrl);

  return NextResponse.json({ videoId: video.id, publicUrl });
}
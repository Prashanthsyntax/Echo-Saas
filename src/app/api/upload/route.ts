import { auth, currentUser } from "@clerk/nextjs/server";
import { supabase, STORAGE_BUCKET, getPublicUrl } from "@/lib/storage";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const contentType = String(formData.get("contentType") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing uploaded file" }, { status: 400 });
  }

  if (!contentType.startsWith("video/")) {
    return NextResponse.json(
      { error: "Missing or invalid video content type" },
      { status: 400 }
    );
  }

  if (file.size < 1024) {
    return NextResponse.json(
      { error: "Recording is too small to upload" },
      { status: 400 }
    );
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // find or create user row - resilient to webhook not having fired yet
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

  const video = await db.video.create({
    data: {
      title: "Untitled Video",
      status: "UPLOADING",
      userId: user.id,
      workspaceId: workspace.id,
    },
  });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = file.name || `recording-${Date.now()}.webm`;
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
    },
  });

  console.log("Video uploaded:", video.id, publicUrl);

  return NextResponse.json({ videoId: video.id, publicUrl });
}

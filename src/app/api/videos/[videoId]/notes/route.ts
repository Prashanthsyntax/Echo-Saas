import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/permissions";

// GET — fetch notes for a video
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;

  const video = await db.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      title: true,
      structuredNotes: true,
      transcript: true,
      summary: true,
      keyPoints: true,
      actionItems: true,
      topics: true,
      language: true,
      speakerCount: true,
      notesEditedAt: true,
    },
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  return NextResponse.json({ video });
}

// PATCH — update notes (manual edit by user)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { videoId } = await params;
  const { structuredNotes } = await req.json();

  if (!structuredNotes?.trim()) {
    return NextResponse.json(
      { error: "structuredNotes required" },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const video = await db.video.findUnique({
    where: { id: videoId },
    select: { workspaceId: true, title: true },
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // check edit permission
  const membership = await db.membership.findUnique({
    where: {
      userId_workspaceId: { userId: user.id, workspaceId: video.workspaceId },
    },
  });

  if (!membership || !hasPermission(membership.role, "UPLOAD_VIDEO")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await db.video.update({
    where: { id: videoId },
    data: {
      structuredNotes,
      notesEditedAt: new Date(),
    },
  });

  // re-ingest updated notes into RAG
  const CHROMA_URL = process.env.CHROMA_SERVICE_URL;
  if (CHROMA_URL) {
    try {
      // delete old version
      await fetch(`${CHROMA_URL}/documents/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: video.workspaceId,
          source: `Video: ${video.title}`,
        }),
      });
      // ingest updated version
      await fetch(`${CHROMA_URL}/ingest/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: video.workspaceId,
          content: structuredNotes,
          source: `Video: ${video.title}`,
          source_type: "video_notes",
        }),
      });
    } catch (err) {
      console.warn("RAG re-ingest failed:", err);
    }
  }

  return NextResponse.json({ success: true, notesEditedAt: updated.notesEditedAt });
}
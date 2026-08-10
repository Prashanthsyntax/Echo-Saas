import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { groq } from "@/lib/groq";
import { NextResponse } from "next/server";
import { generateStructuredNotes } from "@/lib/notes-generator";

const CHROMA_URL = process.env.CHROMA_SERVICE_URL;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { videoId } = await params;

  const video = await db.video.findUnique({
    where: { id: videoId },
    include: { workspace: true },
  });

  if (!video || !video.url) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    // ── STEP 1: Download the video file ────────────────────────────────
    console.log("📥 Downloading video for transcription...");
    const videoRes = await fetch(video.url);
    if (!videoRes.ok) {
      throw new Error("Failed to download video");
    }

    const videoBuffer = await videoRes.arrayBuffer();
    const videoBlob = new Blob([videoBuffer], { type: "audio/webm" });

    // ── STEP 2: Transcribe with Groq Whisper ───────────────────────────
    console.log("🎙 Transcribing with Groq Whisper Large v3...");

    const formData = new FormData();
    formData.append("file", videoBlob, `${videoId}.webm`);
    formData.append("model", "whisper-large-v3");
    formData.append("response_format", "verbose_json"); // get timestamps + language
    formData.append("temperature", "0");

    const whisperRes = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: formData,
      }
    );

    if (!whisperRes.ok) {
      const err = await whisperRes.text();
      throw new Error(`Whisper failed: ${err}`);
    }

    const whisperData = await whisperRes.json();
    const rawTranscript: string = whisperData.text ?? "";
    const detectedLanguage: string = whisperData.language ?? "en";

    if (!rawTranscript.trim()) {
      throw new Error("Empty transcript — video may have no audio");
    }

    console.log(`✅ Transcribed ${rawTranscript.length} chars in ${detectedLanguage}`);

    // ── STEP 3: Generate structured notes with Groq Llama ─────────────
    console.log("📝 Generating structured notes...");
    const notes = await generateStructuredNotes(rawTranscript, video.title);

    // ── STEP 4: Save everything to DB ─────────────────────────────────
    console.log("💾 Saving to database...");
    await db.video.update({
      where: { id: videoId },
      data: {
        transcript: rawTranscript,
        structuredNotes: notes.structuredNotes,
        summary: notes.summary,
        keyPoints: notes.keyPoints,
        actionItems: notes.actionItems,
        topics: notes.topics,
        language: notes.language,
        speakerCount: notes.speakerCount,
        title:
          video.title === "Untitled Video" ? notes.title : video.title,
        status: "READY",
      },
    });

    console.log("✅ DB updated");

    // ── STEP 5: Auto-ingest structured notes into RAG ─────────────────
    if (CHROMA_URL && notes.structuredNotes) {
      console.log("🧠 Ingesting into RAG pipeline...");
      const ragNamespace = video.workspaceId;
      try {
        await fetch(`${CHROMA_URL}/ingest/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: ragNamespace,
            content: notes.structuredNotes,
            source: `Video: ${notes.title}`,
            source_type: "video_notes",
          }),
        });
        console.log("✅ Ingested into RAG");
      } catch (ragErr) {
        console.warn("RAG ingestion failed (non-fatal):", ragErr);
      }
    }

    // ── STEP 6: Log activity ──────────────────────────────────────────
    try {
      await db.activityLog.create({
        data: {
          workspaceId: video.workspaceId,
          userId: user.id,
          type: "VIDEO_UPLOADED",
          description: `video "${notes.title}" transcribed and notes generated`,
          metadata: {
            videoId,
            language: notes.language,
            topicsCount: notes.topics.length,
            keyPointsCount: notes.keyPoints.length,
          },
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      transcript: rawTranscript,
      notes: notes.structuredNotes,
      summary: notes.summary,
      keyPoints: notes.keyPoints,
      actionItems: notes.actionItems,
      topics: notes.topics,
      language: notes.language,
    });
  } catch (err) {
    console.error("Transcription error:", err);

    // set status back to READY so video is still playable
    await db.video.update({
      where: { id: videoId },
      data: { status: "READY" },
    });

    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Transcription failed",
      },
      { status: 500 }
    );
  }
}
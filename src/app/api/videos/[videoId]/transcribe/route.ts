import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { transcribeAudio, generateVideoSummary } from "@/lib/groq";
import { NextResponse } from "next/server";

export async function POST(
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
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  if (!video.url) {
    return NextResponse.json(
      { error: "Video has no URL yet" },
      { status: 400 }
    );
  }

  // mark as processing
  await db.video.update({
    where: { id: videoId },
    data: { status: "PROCESSING" },
  });

  try {
    // 1. download the video from Supabase
    console.log("⬇️  Downloading video for transcription...");
    const videoRes = await fetch(video.url);

    if (!videoRes.ok) {
      throw new Error(`Failed to fetch video: ${videoRes.status}`);
    }

    const arrayBuffer = await videoRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(
      `📦 Video size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`
    );

    // 2. transcribe with Groq Whisper
    console.log("🎙️  Transcribing with Groq Whisper Large v3...");
    const filename = video.url.split("/").pop() ?? "recording.webm";
    const transcript = await transcribeAudio(buffer, filename);

    console.log(
      `✅ Transcript (${transcript.length} chars): ${transcript.slice(0, 100)}...`
    );

    // 3. generate title + summary with Groq Llama
    console.log("🤖 Generating title and summary with Llama 3.3 70B...");
    const { title, summary } = await generateVideoSummary(
      transcript,
      video.duration
    );

    console.log(`✅ Title: ${title}`);
    console.log(`✅ Summary: ${summary}`);

    // 4. update the video row
    const updated = await db.video.update({
      where: { id: videoId },
      data: {
        status: "READY",
        transcript,
        title,
        summary,
      },
    });

    return NextResponse.json({
      success: true,
      videoId,
      title,
      summary,
      transcriptLength: transcript.length,
    });
  } catch (err: unknown) {
    console.error("❌ Transcription failed:", err);

    await db.video.update({
      where: { id: videoId },
      data: { status: "READY" }, // revert to READY not FAILED — video still works, just no AI
    });

    return NextResponse.json(
      {
        error: "Transcription failed",
        detail: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
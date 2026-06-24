import Groq from "groq-sdk";

if (!process.env.GROQ_API_KEY) {
  throw new Error("Missing GROQ_API_KEY");
}

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string,
): Promise<string> {
  // Groq's transcription API accepts a File-like object
  const file = new File([new Uint8Array(audioBuffer)], filename, {
    type: "audio/webm",
  });

  const transcription = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
    response_format: "text",
    language: "en",
  });

  return transcription as unknown as string;
}

export async function generateVideoSummary(
  transcript: string,
  duration: number | null,
): Promise<{ title: string; summary: string }> {
  const durationText = duration
    ? `${Math.floor(duration / 60)}m ${duration % 60}s`
    : "unknown duration";

  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that generates concise titles and summaries for screen recording videos. 
Always respond with valid JSON only — no markdown, no explanation, just the JSON object.`,
      },
      {
        role: "user",
        content: `Here is a transcript of a screen recording (duration: ${durationText}):

"${transcript.slice(0, 3000)}"

Generate a short, descriptive title (max 8 words) and a 2-3 sentence summary of what was covered.

Respond with exactly this JSON format:
{
  "title": "...",
  "summary": "..."
}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 300,
  });

  const content = response.choices[0]?.message?.content ?? "{}";

  try {
    const cleaned = content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return {
      title: parsed.title ?? "Untitled Video",
      summary: parsed.summary ?? "",
    };
  } catch {
    return { title: "Untitled Video", summary: "" };
  }
}

import { groq } from "@/lib/groq";
import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are Echo's helpful assistant. Echo is an async video messaging SaaS that lets users record their screen and webcam, share instant shareable links, and collaborate with timestamped comments.

You help users with:
- How to record videos (screen, webcam, or both)
- How to share video links with teammates or clients  
- How to use workspaces and invite team members
- How commenting and timestamps work on videos
- How to organize videos in folders
- Pricing: Free plan (5-min limit, 25 videos), Pro plan ($12/mo — unlimited length, AI transcripts, no branding), Team plan ($10/user/mo)
- AI features: automatic transcription and summary generated after every recording
- Account and billing questions

Rules:
- Keep answers concise — 2-4 sentences max unless the question genuinely needs more
- If you don't know something specific about Echo, say so honestly rather than guessing
- Don't answer questions unrelated to Echo or video/productivity tools
- Never make up features that haven't been described above
- Be warm and direct — not robotic, not overly enthusiastic`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.slice(-10), // keep last 10 messages for context window
      ],
      temperature: 0.3, // lower = more consistent, accurate answers
      max_tokens: 400,
      stream: false,
    });

    const content = completion.choices[0]?.message?.content ?? "";

    return NextResponse.json({ content });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "Failed to get response" },
      { status: 500 }
    );
  }
}
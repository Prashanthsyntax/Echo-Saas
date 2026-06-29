import { auth } from "@clerk/nextjs/server";
import { groq } from "@/lib/groq";
import { NextResponse } from "next/server";

const CHROMA_URL = process.env.CHROMA_SERVICE_URL!;

const SYSTEM_PROMPT = `You are echo-nemo-1.0, an AI assistant built by Echo.

You answer questions ONLY using the provided context chunks from the user's documents.

Rules:
- Answer directly and concisely
- If the answer is in the context, give it with confidence
- If the context doesn't contain enough information, say exactly: "I don't have enough information in your documents to answer that."
- Never make up information not present in the context
- Cite sources when relevant using [Source: filename] format
- Keep answers focused — 2-5 sentences unless a detailed answer is clearly needed`;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { question, history = [] } = await req.json();

  if (!question?.trim()) {
    return NextResponse.json({ error: "Question required" }, { status: 400 });
  }

  // 1. retrieve relevant chunks from Chroma
  const retrievalRes = await fetch(`${CHROMA_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      question,
      top_k: 5,
    }),
  });

  if (!retrievalRes.ok) {
    return NextResponse.json(
      { error: "Retrieval service unavailable" },
      { status: 503 }
    );
  }

  const retrieval = await retrievalRes.json();

  // 2. if no documents ingested yet — tell user
  if (!retrieval.has_context) {
    return NextResponse.json({
      answer:
        "Your knowledge base is empty. Upload documents, paste a URL, or add your Echo video transcripts to get started.",
      sources: [],
      context_used: false,
    });
  }

  // 3. build the prompt with retrieved context
  const contextBlock = retrieval.chunks
    .map((chunk: string, i: number) => `[Chunk ${i + 1}]:\n${chunk}`)
    .join("\n\n---\n\n");

  const messages = [
    ...history.slice(-6).map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    {
      role: "user" as const,
      content: `Context from your documents:\n\n${contextBlock}\n\n---\n\nQuestion: ${question}`,
    },
  ];

  // 4. generate answer with Groq
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    temperature: 0.1,
    max_tokens: 800,
  });

  const answer = completion.choices[0]?.message?.content ?? "No response generated.";

  return NextResponse.json({
    answer,
    sources: retrieval.sources,
    context_used: true,
    chunks_retrieved: retrieval.chunks.length,
  });
}
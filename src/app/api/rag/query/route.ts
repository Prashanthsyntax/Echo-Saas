import { auth } from "@clerk/nextjs/server";
import { groq } from "@/lib/groq";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
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
- Keep answers focused — 2-5 sentences unless detail is clearly needed`;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { question, history = [], preferredProvider } = await req.json();

  if (!question?.trim()) {
    return NextResponse.json({ error: "Question required" }, { status: 400 });
  }

  // 1. retrieve chunks
  const retrievalRes = await fetch(`${CHROMA_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, question, top_k: 5 }),
  });

  if (!retrievalRes.ok) {
    return NextResponse.json({ error: "Retrieval service unavailable" }, { status: 503 });
  }

  const retrieval = await retrievalRes.json();

  if (!retrieval.has_context) {
    return NextResponse.json({
      answer: "Your knowledge base is empty. Upload documents, paste a URL, or add your Echo video transcripts to get started.",
      sources: [],
      context_used: false,
      model_used: "echo-nemo-1.0",
    });
  }

  const contextBlock = retrieval.chunks
    .map((chunk: string, i: number) => `[Chunk ${i + 1}]:\n${chunk}`)
    .join("\n\n---\n\n");

  const userMessage = `Context from your documents:\n\n${contextBlock}\n\n---\n\nQuestion: ${question}`;

  // 2. check if user has an active connected agent
  const user = await db.user.findUnique({ where: { clerkId: userId } });
  let agentKey = null;

  if (user) {
    agentKey = await db.agentKey.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        ...(preferredProvider ? { provider: preferredProvider } : {}),
      },
    });
  }

  // 3. generate answer — agent model or echo-nemo-1.0
  let answer = "";
  let modelUsed = "echo-nemo-1.0 (Groq Llama 3.3 70B)";

  if (agentKey) {
    const decrypted = decrypt(agentKey.keyHash);
    const result = await callAgentModel(
      agentKey.provider,
      agentKey.model,
      decrypted,
      SYSTEM_PROMPT,
      history,
      userMessage
    );
    answer = result.answer;
    modelUsed = `${agentKey.provider} / ${agentKey.model}`;
  } else {
    // default: Groq Llama
    const messages = [
      ...history.slice(-6).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: userMessage },
    ];

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.1,
      max_tokens: 800,
    });
    answer = completion.choices[0]?.message?.content ?? "No response.";
  }

  return NextResponse.json({
    answer,
    sources: retrieval.sources,
    context_used: true,
    chunks_retrieved: retrieval.chunks.length,
    model_used: modelUsed,
  });
}

// ── agent model callers ───────────────────────────────────────────────────────

async function callAgentModel(
  provider: string,
  model: string,
  apiKey: string,
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string
): Promise<{ answer: string }> {
  const messages = [
    ...history.slice(-6),
    { role: "user", content: userMessage },
  ];

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.1,
        max_tokens: 800,
      }),
    });
    const data = await res.json();
    return { answer: data.choices?.[0]?.message?.content ?? "No response." };
  }

  if (provider === "claude") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages,
        max_tokens: 800,
      }),
    });
    const data = await res.json();
    return { answer: data.content?.[0]?.text ?? "No response." };
  }

  if (provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        }),
      }
    );
    const data = await res.json();
    return {
      answer:
        data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response.",
    };
  }

  if (provider === "mistral") {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.1,
        max_tokens: 800,
      }),
    });
    const data = await res.json();
    return { answer: data.choices?.[0]?.message?.content ?? "No response." };
  }

  return { answer: "Unsupported provider." };
}
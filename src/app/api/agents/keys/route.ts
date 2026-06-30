import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { encrypt, decrypt, keyHint } from "@/lib/crypto";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ keys: [] });

  const keys = await db.agentKey.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  // never expose encrypted key — only hint and metadata
  return NextResponse.json({
    keys: keys.map((k) => ({
      id: k.id,
      provider: k.provider,
      model: k.model,
      keyHint: k.keyHint,
      isActive: k.isActive,
      createdAt: k.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider, apiKey, model } = await req.json();

  if (!provider || !apiKey || !model) {
    return NextResponse.json(
      { error: "provider, apiKey, and model are required" },
      { status: 400 }
    );
  }

  // validate the key works before storing it
  const valid = await validateKey(provider, apiKey, model);
  if (!valid.ok) {
    return NextResponse.json(
      { error: `Key validation failed: ${valid.error}` },
      { status: 400 }
    );
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const encrypted = encrypt(apiKey);
  const hint = keyHint(apiKey);

  const key = await db.agentKey.upsert({
    where: { userId_provider: { userId: user.id, provider } },
    update: { keyHash: encrypted, keyHint: hint, model, isActive: true },
    create: {
      userId: user.id,
      provider,
      keyHash: encrypted,
      keyHint: hint,
      model,
    },
  });

  return NextResponse.json({
    id: key.id,
    provider: key.provider,
    model: key.model,
    keyHint: key.keyHint,
    isActive: key.isActive,
  });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider } = await req.json();

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.agentKey.deleteMany({ where: { userId: user.id, provider } });
  return NextResponse.json({ success: true });
}

// ── key validation ────────────────────────────────────────────────────────────

async function validateKey(
  provider: string,
  apiKey: string,
  model: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return { ok: false, error: "Invalid OpenAI API key" };
    } else if (provider === "claude") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 8,
          messages: [{ role: "user", content: "Hi" }],
        }),
      });
      if (res.status === 401) return { ok: false, error: "Invalid Anthropic API key" };
    } else if (provider === "gemini") {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
      );
      if (!res.ok) return { ok: false, error: "Invalid Gemini API key" };
    } else if (provider === "mistral") {
      const res = await fetch("https://api.mistral.ai/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return { ok: false, error: "Invalid Mistral API key" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach provider API" };
  }
}
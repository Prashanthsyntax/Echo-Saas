/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { groq } from "@/lib/groq";
import { NextResponse } from "next/server";

const CHROMA_URL = process.env.CHROMA_SERVICE_URL!;

// POST — run contradiction check after new ingestion
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    workspaceId,
    newChunks,
    newSource,
    newSourceType,
  } = await req.json();

  if (!workspaceId || !newChunks?.length || !newSource) {
    return NextResponse.json({ error: "workspaceId, newChunks, newSource required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const membership = await db.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    // Step 1: cosine similarity check via Chroma
    const chromaRes = await fetch(`${CHROMA_URL}/contradiction/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id:              workspaceId,
        new_chunks:           newChunks.slice(0, 10),
        new_source:           newSource,
        new_source_type:      newSourceType,
        similarity_threshold: 0.75,
        top_k:                5,
      }),
    });

    if (!chromaRes.ok) return NextResponse.json({ contradictions: [] });

    const { contradictions: candidates } = await chromaRes.json();
    if (!candidates?.length) return NextResponse.json({ contradictions: [] });

    // Step 2: LLM verification for high-similarity candidates
    const verified = [];

    for (const candidate of candidates.slice(0, 5)) { // max 5 LLM calls
      const prompt = `You are analyzing two text chunks from a team knowledge base to determine if they contain contradictory information.

CHUNK A (from "${candidate.existing_source}", older document):
"${candidate.existing_chunk}"

CHUNK B (from "${newSource}", newer document):
"${candidate.new_chunk}"

Cosine similarity score: ${candidate.similarity}

Analyze these chunks and respond with ONLY a JSON object:
{
  "is_contradiction": true or false,
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "explanation": "One sentence explaining what specifically contradicts",
  "recommendation": "One sentence on what action should be taken"
}

Rules:
- is_contradiction: true ONLY if they make incompatible factual claims
- Similar topics but no conflict = false
- Complementary information = false
- severity CRITICAL: safety/security/legal/financial contradiction
- severity HIGH: process or policy contradiction that would cause errors
- severity MEDIUM: factual inconsistency that could cause confusion
- severity LOW: minor wording or preference difference`;

      try {
        const llmRes = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 300,
          response_format: { type: "json_object" },
        });

        const raw = llmRes.choices[0]?.message?.content ?? "{}";
        const verdict = JSON.parse(raw);

        if (verdict.is_contradiction) {
          // save to DB
          const saved = await db.knowledgeContradiction.create({
            data: {
              workspaceId,
              sourceDocA:      candidate.existing_source,
              sourceDocB:      newSource,
              chunkTextA:      candidate.existing_chunk,
              chunkTextB:      candidate.new_chunk,
              similarityScore: candidate.similarity,
              llmVerdict:      `${verdict.explanation} — ${verdict.recommendation}`,
              severity:        verdict.severity as any,
              status:          "OPEN",
            },
          });

          // log activity for CRITICAL/HIGH contradictions
          if (verdict.severity === "CRITICAL" || verdict.severity === "HIGH") {
            await db.activityLog.create({
              data: {
                workspaceId,
                userId:      user.id,
                type:        "DOCUMENT_INGESTED",
                description: `⚠️ ${verdict.severity} contradiction detected between "${candidate.existing_source}" and "${newSource}"`,
                metadata: {
                  contradictionId: saved.id,
                  severity:        verdict.severity,
                  explanation:     verdict.explanation,
                },
              },
            });
          }

          verified.push({
            ...saved,
            explanation:     verdict.explanation,
            recommendation:  verdict.recommendation,
          });
        }
      } catch (llmErr) {
        console.warn("LLM contradiction check failed:", llmErr);
      }
    }

    return NextResponse.json({
      contradictions:    verified,
      candidatesChecked: candidates.length,
      detected:          verified.length,
    });
  } catch (err) {
    console.error("Contradiction check error:", err);
    return NextResponse.json({ error: "Check failed" }, { status: 500 });
  }
}

// PATCH — update contradiction status (resolve/dismiss)
export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { contradictionId, status, workspaceId } = await req.json();

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.knowledgeContradiction.update({
    where: { id: contradictionId },
    data: {
      status,
      resolvedBy: status !== "OPEN" ? user.id : null,
      resolvedAt: status !== "OPEN" ? new Date() : null,
    },
  });

  return NextResponse.json({ success: true, contradiction: updated });
}
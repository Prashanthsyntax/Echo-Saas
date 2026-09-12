/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

const CHROMA_URL = process.env.CHROMA_SERVICE_URL!;

// GET — fetch decay report for workspace
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const membership = await db.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    // get live decay report from Chroma
    const chromaRes = await fetch(`${CHROMA_URL}/decay/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: workspaceId }),
    });

    const chromaData = chromaRes.ok ? await chromaRes.json() : { documents: [] };

    // get contradictions from DB
    const contradictions = await db.knowledgeContradiction.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // compute workspace health score
    const docs = chromaData.documents ?? [];
    const avgDecay = docs.length > 0
      ? docs.reduce((sum: number, d: any) => sum + d.avg_decay, 0) / docs.length
      : 1.0;

    const openContradictions = contradictions.filter((c) => c.status === "OPEN");
    const criticalCount = openContradictions.filter((c) => c.severity === "CRITICAL").length;
    const highCount = openContradictions.filter((c) => c.severity === "HIGH").length;

    // health score: decay (60%) + contradiction penalty (40%)
    const contradictionPenalty = Math.min(
      0.4,
      criticalCount * 0.15 + highCount * 0.08
    );
    const healthScore = Math.max(0, avgDecay * 0.6 + (0.4 - contradictionPenalty));

    return NextResponse.json({
      documents:       docs,
      contradictions,
      healthScore:     Math.round(healthScore * 100),
      avgDecay:        Math.round(avgDecay * 100),
      staleCount:      docs.filter((d: any) => d.is_stale).length,
      warningCount:    docs.filter((d: any) => d.is_warning).length,
      freshCount:      docs.filter((d: any) => d.is_fresh).length,
      openContradictions: openContradictions.length,
    });
  } catch (err) {
    console.error("Decay report error:", err);
    return NextResponse.json({ error: "Failed to generate decay report" }, { status: 500 });
  }
}
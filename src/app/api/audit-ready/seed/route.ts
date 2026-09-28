/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { seedAuditData, SYNTHETIC_FINDINGS } from "@/lib/audit-seed";

const CHROMA_URL = process.env.CHROMA_SERVICE_URL ?? "http://localhost:8000";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId } = await req.json();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  // seed DB
  await seedAuditData(workspaceId);

  // write all synthetic findings to ChromaDB memory
  for (const f of SYNTHETIC_FINDINGS) {
    const memId  = `seed_finding_${workspaceId}_${f.title.slice(0, 20).replace(/\s/g, "_")}`;
    const status = (f as any).status ?? "OPEN";
    const summary = [
      `Audit finding: ${f.title}.`,
      `Severity: ${f.severity}.`,
      `Control: ${f.controlId}.`,
      `Root cause: ${f.rootCause}`,
      `Affected: ${f.affectedSystem}.`,
      `Status: ${status}.`,
      `Discovered: ${new Date(f.discoveredAt).toLocaleDateString()}.`,
      (f as any).remediatedAt ? `Remediated: ${new Date((f as any).remediatedAt).toLocaleDateString()}.` : "",
      f.isRecurring ? `⚠ RECURRING — appeared ${f.recurrenceCount + 1} times.` : "",
      `Auditor notes: ${f.auditorNotes}`,
    ].filter(Boolean).join(" ");

    await fetch(`${CHROMA_URL}/audit/memory/write`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        workspace_id: workspaceId,
        memory_id:    memId,
        memory_type:  "finding",
        summary,
        control_id:   f.controlId,
        severity:     f.severity,
        status,
        metadata: {
          discovered_at: f.discoveredAt.toISOString(),
          cwe_id:        f.cweId,
          is_recurring:  f.isRecurring ? "true" : "false",
        },
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, findingsSeeded: SYNTHETIC_FINDINGS.length });
}
/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { groq } from "@/lib/groq";
import { NextResponse } from "next/server";

const CHROMA_URL = process.env.CHROMA_SERVICE_URL ?? "http://localhost:8000";

// CWE → SOC 2 control mapping
const CWE_TO_CONTROL: Record<string, string> = {
  "CWE-89":  "CC6.6", "CWE-79":  "CC6.6", "CWE-78":  "CC6.6",
  "CWE-918": "CC6.6", "CWE-943": "CC6.6",
  "CWE-798": "CC6.3", "CWE-522": "CC6.3", "CWE-613": "CC6.3",
  "CWE-306": "CC6.1", "CWE-287": "CC6.1", "CWE-22":  "CC6.1",
  "CWE-307": "CC6.1",
  "CWE-942": "CC6.7", "CWE-319": "CC6.7", "CWE-311": "CC6.7",
  "CWE-770": "CC7.1", "CWE-400": "CC7.1",
  "CWE-20":  "CC7.2", "CWE-601": "CC7.2",
  "CWE-502": "CC8.1", "CWE-611": "CC8.1",
  "CWE-347": "CC6.1",
};

interface AuditMemory {
  summary:        string;
  memory_type:    string;
  control_id:     string;
  finding_id:     string;
  severity:       string;
  status:         string;
  created_at:     string;
  relevance_score:number;
}

async function retrieveMemories(
  workspaceId: string,
  query:       string
): Promise<AuditMemory[]> {
  try {
    const res = await fetch(`${CHROMA_URL}/audit/memory/query`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ workspace_id: workspaceId, query, n_results: 8 }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.memories ?? [];
  } catch {
    return [];
  }
}

async function writeMemory(
  workspaceId: string,
  memoryId:    string,
  type:        string,
  summary:     string,
  meta:        Record<string, string> = {}
) {
  try {
    await fetch(`${CHROMA_URL}/audit/memory/write`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        workspace_id: workspaceId,
        memory_id:    memoryId,
        memory_type:  type,
        summary,
        ...meta,
      }),
    });
  } catch {}
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { workspaceId, message, conversationId } = await req.json();
    if (!workspaceId || !message?.trim()) {
      return NextResponse.json({ error: "workspaceId and message required" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // ── get or create conversation ───────────────────────────────────
    let conversation: any = null;
    if (conversationId) {
      // findFirst + workspaceId so a user can't attach to another workspace's conversation
      conversation = await db.auditConversation.findFirst({
        where: { id: conversationId, workspaceId },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } },
      });
    }
    if (!conversation) {
      conversation = await db.auditConversation.create({
        data: { workspaceId, title: message.slice(0, 60) },
        include: { messages: true },
      });
    }

    // count all messages (the include above is capped at 20)
    const existingCount = await db.auditConversationMessage.count({
      where: { conversationId: conversation.id },
    });
    const interactionNumber = existingCount + 1;

    // ── Step 1: retrieve relevant memories ───────────────────────────
    const memories = await retrieveMemories(workspaceId, message);

    // ── Step 2: pull live SentraCode findings ────────────────────────
    const openFindings = await db.sentraFinding.findMany({
      where:   { repo: { workspaceId }, status: { in: ["OPEN", "IN_REVIEW"] } },
      include: { repo: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take:    10,
    });

    // ── Step 3: pull audit findings ──────────────────────────────────
    const auditFindings = await db.auditFinding.findMany({
      where:   { workspaceId },
      include: { control: { select: { controlId: true, title: true } } },
      orderBy: { discoveredAt: "desc" },
      take:    15,
    });

    // ── Step 4: control health summary ───────────────────────────────
    const controls = await db.complianceControl.findMany({
      where: { workspaceId },
      include: {
        findings: { where: { status: { in: ["OPEN", "IN_REMEDIATION"] } } },
      },
    });

    // map live SentraCode findings to controls
    const liveControlIssues: Record<string, string[]> = {};
    for (const f of openFindings) {
      const ctrl = f.cwe ? CWE_TO_CONTROL[f.cwe] : null;
      if (ctrl) {
        if (!liveControlIssues[ctrl]) liveControlIssues[ctrl] = [];
        liveControlIssues[ctrl].push(f.title);
      }
    }

    // ── Step 5: build system prompt ──────────────────────────────────
    const memoryContext = memories.length > 0
      ? `\n\nRELEVANT AUDIT MEMORIES (retrieved from compliance history):\n${
          memories.map((m, i) =>
            `[Memory ${i+1} | ${m.memory_type} | relevance: ${m.relevance_score} | control: ${m.control_id} | ${m.created_at?.slice(0,10)}]\n${m.summary}`
          ).join("\n\n")
        }`
      : "\n\n(No relevant audit memories found yet — this is an early interaction. Give general guidance.)";

    const findingsContext = auditFindings.length > 0
      ? `\n\nAUDIT FINDING HISTORY (${auditFindings.length} total):\n${
          auditFindings.slice(0, 8).map(f =>
            `- [${f.severity}] ${f.title} → Control: ${f.control?.controlId ?? "unmapped"} → Status: ${f.status}${f.isRecurring ? " ⚠ RECURRING" : ""} (${new Date(f.discoveredAt).toLocaleDateString()})`
          ).join("\n")
        }`
      : "";

    const liveContext = openFindings.length > 0
      ? `\n\nLIVE SENTRACODE FINDINGS (open right now):\n${
          openFindings.slice(0, 5).map(f =>
            `- [${f.severity}] ${f.title} in ${f.filePath} — CWE: ${f.cwe ?? "unknown"} → maps to SOC 2 ${f.cwe ? (CWE_TO_CONTROL[f.cwe] ?? "unmapped") : "unmapped"}`
          ).join("\n")
        }`
      : "";

    const controlContext = controls.length > 0
      ? `\n\nCONTROL STATUS:\n${
          controls.map(c => {
            const liveIssues = liveControlIssues[c.controlId]?.length ?? 0;
            const auditIssues = c.findings.length;
            const status = (liveIssues + auditIssues) > 0 ? "⚠ FAILING" : c.status;
            return `- ${c.controlId}: ${c.title} → ${status} (${liveIssues} live issues, ${auditIssues} audit issues)`;
          }).join("\n")
        }`
      : "";

    const systemPrompt = `You are AuditReady, an AI compliance copilot embedded in SentraCode.
You have memory of this workspace's full audit history and real-time access to their security findings.

Your role:
- Help engineering teams achieve and maintain SOC 2 compliance
- Cite specific past findings and remediation events from memory
- Detect recurring patterns (same control failing repeatedly = systemic issue)
- Predict which controls are at risk based on history
- Be proactive: if you see a pattern forming, flag it even if not asked
- Be specific: reference actual file paths, dates, CWE codes, control IDs

Interaction number: ${interactionNumber}
${interactionNumber <= 3 ? "Note: Limited history available. Give general guidance while noting you'll get more precise as history accumulates." : ""}
${interactionNumber >= 10 ? "Note: You have significant audit history. Cite specific past findings. Predict recurrences. Be proactive about gaps." : ""}
${interactionNumber >= 20 ? "Note: You now have deep audit history. Proactively flag patterns. Identify systemic issues. Predict audit outcomes." : ""}
${memoryContext}
${findingsContext}
${liveContext}
${controlContext}

Format your response as:
1. Direct answer to the question
2. Specific findings or history cited (if any)
3. Risk assessment or prediction (if relevant)
4. Recommended next steps

Be concise but specific. Always cite control IDs (e.g. CC6.6) and actual finding titles when available.`;

    // ── Step 6: call Groq ────────────────────────────────────────────
    const history = (conversation.messages ?? []).slice(-8).map((m: any) => ({
      role:    m.role === "agent" ? "assistant" : "user",
      content: m.content,
    }));

    const groqRes = await groq.chat.completions.create({
      model:   "openai/gpt-oss-120b",
      messages:[
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user",   content: message },
      ],
      temperature: 0.3,
      max_tokens:  1200,
    });

    const answer = groqRes.choices[0]?.message?.content ?? "Unable to generate response.";

    // ── Step 7: write new memory ─────────────────────────────────────
    const memoryId = `audit_chat_${workspaceId}_${Date.now()}`;
    const memorySummary = `User asked: "${message.slice(0,100)}" | Agent answered: "${answer.slice(0,200)}" | Interaction #${interactionNumber}`;
    await writeMemory(workspaceId, memoryId, "agent_insight", memorySummary, {
      severity: "INFO",
      status:   "ACTIVE",
    });

    // also write finding memories for any new open findings
    for (const f of openFindings.slice(0, 3)) {
      const fMemId = `finding_${f.id}`;
      const fSummary = `Security finding: ${f.title} in ${f.filePath}. CWE: ${f.cwe ?? "unknown"}. Severity: ${f.severity}. Maps to SOC 2 control ${f.cwe ? (CWE_TO_CONTROL[f.cwe] ?? "unmapped") : "unmapped"}. Status: ${f.status}. Discovered: ${new Date(f.createdAt).toLocaleDateString()}.`;
      await writeMemory(workspaceId, fMemId, "finding", fSummary, {
        control_id: f.cwe ? (CWE_TO_CONTROL[f.cwe] ?? "") : "",
        severity:   f.severity,
        status:     f.status,
      });
    }

    // ── Step 8: save to DB ───────────────────────────────────────────
    // FIX: use conversation.id (always defined), not the request-body conversationId (null on first message)
    await db.auditConversationMessage.create({
      data: {
        conversationId:    conversation.id,
        role:              "user",
        content:           message,
        interactionNumber,
      },
    });

    const agentMessage = await db.auditConversationMessage.create({
      data: {
        conversationId:     conversation.id,
        role:               "agent",
        content:            answer,
        memoriesUsed:       memories as any,
        controlsReferenced: Object.keys(liveControlIssues),
        findingsReferenced: openFindings.map(f => f.id),
        interactionNumber:  interactionNumber + 1,
      },
    });

    // log memories used to DB for timeline panel
    for (const mem of memories) {
      await db.auditMemoryLog.create({
        data: {
          workspaceId,
          memoryType:  mem.memory_type,
          summary:     mem.summary,
          controlId:   mem.control_id || null,
          metadata:    { relevanceScore: mem.relevance_score, query: message },
        },
      }).catch(() => {});
    }

    // compute control health scorecard
    const scorecard = controls.map(c => {
      const live    = liveControlIssues[c.controlId]?.length ?? 0;
      const open    = c.findings.length;
      const total   = live + open;
      const status  = total === 0 ? "PASSING" : total <= 1 ? "NEEDS_REVIEW" : "FAILING";
      return {
        controlId:   c.controlId,
        title:       c.title,
        status,
        liveIssues:  live,
        auditIssues: open,
      };
    });

    return NextResponse.json({
      answer,
      conversationId:     conversation.id,
      interactionNumber:  interactionNumber + 1,
      memoriesUsed:       memories,
      controlsStatus:     scorecard,
      liveFindings:       openFindings.length,
      message:            agentMessage,
    });
  } catch (err) {
    // Always return JSON so the client's res.json() never hits an empty body
    console.error("[audit-ready/chat] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
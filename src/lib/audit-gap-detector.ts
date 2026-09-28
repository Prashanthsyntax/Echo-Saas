/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/lib/db";
import { pusherServer, CHANNELS } from "@/lib/pusher";

const CHROMA_URL = process.env.CHROMA_SERVICE_URL ?? "http://localhost:8000";

const CWE_TO_SOC2: Record<string, { controlId: string; title: string }> = {
  "CWE-89":  { controlId: "CC6.6", title: "Injection — SQL/NoSQL"        },
  "CWE-79":  { controlId: "CC6.6", title: "XSS — Cross-Site Scripting"   },
  "CWE-78":  { controlId: "CC6.6", title: "Command Injection"             },
  "CWE-918": { controlId: "CC6.6", title: "SSRF"                          },
  "CWE-943": { controlId: "CC6.6", title: "NoSQL Injection"               },
  "CWE-798": { controlId: "CC6.3", title: "Hardcoded Credentials"         },
  "CWE-522": { controlId: "CC6.3", title: "Insufficiently Protected Creds"},
  "CWE-613": { controlId: "CC6.3", title: "Insufficient Session Expiry"   },
  "CWE-306": { controlId: "CC6.1", title: "Missing Auth Check"            },
  "CWE-287": { controlId: "CC6.1", title: "Improper Authentication"       },
  "CWE-22":  { controlId: "CC6.1", title: "Path Traversal"               },
  "CWE-307": { controlId: "CC6.1", title: "Brute Force — No Rate Limit"  },
  "CWE-347": { controlId: "CC6.1", title: "JWT Algorithm Bypass"          },
  "CWE-942": { controlId: "CC6.7", title: "Permissive CORS"               },
  "CWE-319": { controlId: "CC6.7", title: "Cleartext Transmission"        },
  "CWE-311": { controlId: "CC6.7", title: "Missing Encryption"            },
  "CWE-770": { controlId: "CC7.1", title: "Missing Rate Limit"            },
  "CWE-400": { controlId: "CC7.1", title: "Uncontrolled Resource Use"     },
  "CWE-20":  { controlId: "CC7.2", title: "Improper Input Validation"     },
  "CWE-601": { controlId: "CC7.2", title: "Open Redirect"                 },
  "CWE-502": { controlId: "CC8.1", title: "Insecure Deserialization"      },
  "CWE-611": { controlId: "CC8.1", title: "XXE Injection"                 },
  "CWE-532": { controlId: "CC6.3", title: "Secrets in Logs"               },
};

interface Gap {
  controlId:       string;
  controlTitle:    string;
  finding:         string;
  severity:        string;
  filePath:        string;
  cweId:           string;
  isRecurring:     boolean;
  previousFinding: string | null;
}

export async function detectComplianceGaps(
  scanId:      string,
  workspaceId: string
): Promise<Gap[]> {
  // fetch findings from this scan
  const findings = await db.sentraFinding.findMany({
    where: { scanId, status: { in: ["OPEN", "IN_REVIEW"] } },
    select: {
      id: true, title: true, severity: true,
      filePath: true, cwe: true, lineNumber: true,
    },
  });

  if (findings.length === 0) return [];

  const gaps: Gap[] = [];

  for (const f of findings) {
    if (!f.cwe) continue;
    const control = CWE_TO_SOC2[f.cwe];
    if (!control) continue;

    // check if this control has had a past finding with same CWE
    const previousFindings = await db.auditFinding.findMany({
      where: {
        workspaceId,
        cweId:  f.cwe,
        status: { in: ["REMEDIATED", "OPEN", "IN_REMEDIATION"] },
      },
      orderBy: { discoveredAt: "desc" },
      take:    1,
    });

    const isRecurring     = previousFindings.length > 0;
    const previousFinding = previousFindings[0]?.title ?? null;

    gaps.push({
      controlId:    control.controlId,
      controlTitle: control.title,
      finding:      f.title,
      severity:     f.severity,
      filePath:     f.filePath,
      cweId:        f.cwe,
      isRecurring,
      previousFinding,
    });

    // write gap to ChromaDB memory
    const memId  = `gap_${f.id}_${Date.now()}`;
    const summary = [
      `New scan detected: ${f.title} in ${f.filePath}.`,
      `CWE: ${f.cwe}. Severity: ${f.severity}.`,
      `Breaks SOC 2 control ${control.controlId} (${control.title}).`,
      isRecurring ? `⚠ RECURRING — same CWE previously appeared as: "${previousFinding}". Pattern indicates systemic issue.` : "First occurrence of this issue.",
      `Scan ID: ${scanId}.`,
    ].join(" ");

    await fetch(`${CHROMA_URL}/audit/memory/write`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        workspace_id: workspaceId,
        memory_id:    memId,
        memory_type:  "finding",
        summary,
        control_id:   control.controlId,
        severity:     f.severity,
        status:       "OPEN",
        metadata: { scan_id: scanId, cwe_id: f.cwe, is_recurring: isRecurring ? "true" : "false" },
      }),
    }).catch(() => {});

    // upsert as AuditFinding in DB
    const dbControl = await db.complianceControl.findFirst({
      where: { workspaceId, controlId: control.controlId },
    });

    await db.auditFinding.upsert({
      where: { id: `scan_${f.id}` },
      update: {
        status:         "OPEN",
        isRecurring,
        recurrenceCount:isRecurring ? { increment: 1 } : 0,
      },
      create: {
        id:             `scan_${f.id}`,
        workspaceId,
        title:          f.title,
        description:    `Detected by SentraCode scanner in scan ${scanId}`,
        severity:       f.severity as any,
        status:         "OPEN",
        cweId:          f.cwe,
        controlId:      dbControl?.id ?? null,
        affectedSystem: f.filePath,
        sentraFindingId:f.id,
        isRecurring,
        recurrenceCount:isRecurring ? 1 : 0,
        discoveredAt:   new Date(),
      },
    }).catch(() => {});
  }

  // push Pusher notification if critical gaps found
  const criticalGaps = gaps.filter(g => g.severity === "CRITICAL");
  const recurringGaps = gaps.filter(g => g.isRecurring);

  if (criticalGaps.length > 0 || recurringGaps.length > 0) {
    try {
      await pusherServer.trigger(
        CHANNELS.workspace(workspaceId),
        "audit-gap-detected",
        {
          totalGaps:     gaps.length,
          criticalGaps:  criticalGaps.length,
          recurringGaps: recurringGaps.length,
          topGap:        criticalGaps[0] ?? recurringGaps[0] ?? gaps[0],
          scanId,
        }
      );
    } catch {}
  }

  return gaps;
}
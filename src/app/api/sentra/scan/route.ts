/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  fetchRepoTree,
  fetchFileContent,
  fetchRepoCommits,
  computeRiskScore,
} from "@/lib/github";
import { requireSentraAuth } from "@/lib/sentra-cli-auth";
import { detectComplianceGaps } from "@/lib/audit-gap-detector";

const SCANNER_URL = process.env.SENTRA_SCANNER_URL ?? "http://localhost:8001";

export async function POST(req: Request) {
  const ctx = await requireSentraAuth(req);
  if (!ctx)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const workspaceId = body.workspaceId ?? ctx.workspaceId;
  const repoId = body.repoId;

  // const user = await db.user.findUnique({ where: { clerkId: userId } });
  // if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const repo = await db.sentraRepo.findUnique({ where: { id: repoId } });
  if (!repo)
    return NextResponse.json({ error: "Repo not found" }, { status: 404 });

  const settings = await db.sentraSettings.findUnique({
    where: { workspaceId },
  });
  const token = settings?.githubToken ?? undefined;

  const scan = await db.sentraScan.create({
    data: {
      repoId,
      status: "SCANNING",
      triggeredBy: "manual",
      branch: repo.defaultBranch,
    },
  });

  await db.sentraRepo.update({
    where: { id: repoId },
    data: { scanStatus: "SCANNING" },
  });

  runFullScan(scan.id, repo, token, workspaceId).catch(console.error);

  return NextResponse.json({ scanId: scan.id, message: "Scan started" });
}

async function runFullScan(
  scanId: string,
  repo: any,
  token: string | undefined,
  workspaceId: string,
) {
  const startTime = Date.now();

  try {
    // fetch file tree
    const tree = await fetchRepoTree(
      repo.owner,
      repo.repoName,
      repo.defaultBranch,
      token,
    );

    const ALLOWED_EXTS = [
      ".py",
      ".js",
      ".ts",
      ".tsx",
      ".jsx",
      ".go",
      ".java",
      ".rb",
      ".php",
      ".cs",
      ".rs",
      ".swift",
      ".kt",
      ".env",
      ".yaml",
      ".yml",
      ".toml",
      ".ini",
      ".cfg",
      ".conf",
      ".xml",
      "package.json",
      "requirements.txt",
      "go.mod",
      "pom.xml",
      "Gemfile",
    ];

    const codeFiles = tree
      .filter(
        (f) =>
          ALLOWED_EXTS.some((e) => f.path.endsWith(e)) &&
          !f.path.includes("node_modules") &&
          !f.path.includes(".next") &&
          !f.path.includes("dist/") &&
          !f.path.includes("vendor/"),
      )
      .slice(0, 40);

    // fetch file contents in parallel (batch of 5)
    const fileContents: { path: string; content: string }[] = [];
    const BATCH = 5;
    for (let i = 0; i < codeFiles.length; i += BATCH) {
      const batch = codeFiles.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async (f) => ({
          path: f.path,
          content: await fetchFileContent(
            repo.owner,
            repo.repoName,
            f.path,
            token,
          ),
        })),
      );
      fileContents.push(...results.filter((f) => f.content.length > 0));

      // update progress
      await db.sentraScan.update({
        where: { id: scanId },
        data: { filesScanned: fileContents.length },
      });
    }

    // call Python scanner microservice
    const scanRes = await fetch(`${SCANNER_URL}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repo_id: repo.id,
        workspace_id: workspaceId,
        files: fileContents,
        layers: ["SAST", "SECRETS", "SCA", "API_SECURITY", "SUPPLY_CHAIN"],
      }),
    });

    if (!scanRes.ok) {
      throw new Error(`Scanner service returned ${scanRes.status}`);
    }

    const scanData = await scanRes.json();

    // persist SAST + API findings
    const allCodeFindings = [
      ...scanData.sast_findings,
      ...scanData.api_findings,
    ];

    for (const f of allCodeFindings) {
      await db.sentraFinding.create({
        data: {
          repoId: repo.id,
          scanId,
          severity: f.severity as any,
          title: f.title,
          description: f.description,
          filePath: f.filePath,
          lineNumber: f.lineNumber ?? null,
          cwe: f.cwe ?? null,
          rule: f.ruleId ?? null,
          snippet: f.snippet ?? null,
          diffBefore: f.snippet ? `- ${f.snippet}` : null,
          diffAfter: f.remediation ? `+ // Fix: ${f.remediation}` : null,
          aiFix: f.remediation ?? null,
          status: "OPEN",
        },
      });
    }

    // persist secret findings
    for (const f of scanData.secret_findings) {
      await db.sentraSecretFinding.create({
        data: {
          repoId: repo.id,
          scanId,
          secretType: f.secretType,
          filePath: f.filePath,
          lineNumber: f.lineNumber ?? null,
          entropy: f.entropy ?? null,
          matchedRule: f.matchedRule ?? null,
          snippet: f.snippet ?? null,
          severity: f.severity as any,
          status: "OPEN",
        },
      });
    }

    // persist SCA findings
    for (const f of scanData.sca_findings) {
      await db.sentraSCAFinding.create({
        data: {
          repoId: repo.id,
          scanId,
          packageName: f.packageName,
          packageVersion: f.packageVersion,
          ecosystem: f.ecosystem,
          vulnerabilityId: f.vulnerabilityId ?? null,
          severity: f.severity as any,
          title: f.title,
          description: f.description ?? null,
          fixedVersion: f.fixedVersion ?? null,
          manifestFile: f.manifestFile,
          isDirect: f.isDirect ?? true,
          isTransitive: f.isTransitive ?? false,
          status: "OPEN",
        },
      });
    }

    // also persist supply chain as findings
    for (const f of scanData.supply_chain) {
      await db.sentraFinding.create({
        data: {
          repoId: repo.id,
          scanId,
          severity: f.severity as any,
          title: f.title,
          description: f.description,
          filePath: f.manifestFile ?? "unknown",
          rule: "supply-chain",
          aiFix: f.remediation ?? null,
          status: "OPEN",
        },
      });
    }

    // sync commits
    const commits = await fetchRepoCommits(
      repo.owner,
      repo.repoName,
      token,
      20,
    );
    for (const c of commits) {
      try {
        await db.sentraCommit.upsert({
          where: { repoId_sha: { repoId: repo.id, sha: c.sha } },
          update: {},
          create: {
            repoId: repo.id,
            sha: c.sha,
            message: c.commit.message.split("\n")[0].slice(0, 200),
            authorName: c.commit.author.name,
            authorEmail: c.commit.author.email,
            branch: repo.defaultBranch,
            additions: c.stats?.additions ?? 0,
            deletions: c.stats?.deletions ?? 0,
            filesChanged: c.files?.length ?? 0,
            committedAt: new Date(c.commit.author.date),
          },
        });
      } catch {}
    }

    // ── AI Reasoning Pipeline ───────────────────────────────────────────────
    let aiFindings = allCodeFindings; // fallback to scanner findings
    let attackPaths: any[] = [];
    let agentRuns: any[] = [];

    try {
      // combine all findings for AI reasoning
      const allRawFindings = [
        ...scanData.sast_findings,
        ...scanData.api_findings,
        ...scanData.secret_findings.map((f: any) => ({
          ...f,
          title: f.title,
          severity: f.severity,
          description: `Secret detected: ${f.title}. Entropy: ${f.entropy}`,
          filePath: f.filePath,
          lineNumber: f.lineNumber,
          category: "SECRETS",
        })),
      ];

      const languages = Object.keys(
        (repo.languages as Record<string, number>) ?? {},
      );

      const aiRes = await fetch(`${SCANNER_URL}/ai/reason`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo_id: repo.id,
          repo_name: repo.fullName,
          workspace_id: workspaceId,
          is_public: !repo.isPrivate,
          languages,
          findings: allRawFindings,
          files: fileContents.map((f) => ({
            path: f.path,
            content: f.content.slice(0, 3000), // truncate for token limits
          })),
        }),
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        aiFindings = aiData.findings ?? allRawFindings;
        attackPaths = aiData.attack_paths ?? [];
        agentRuns = aiData.agent_runs ?? [];
      }
    } catch (err) {
      console.warn("AI reasoning pipeline failed, using raw findings:", err);
    }

    // persist enriched findings with AI data
    for (const f of aiFindings) {
      await db.sentraFinding.create({
        data: {
          repoId: repo.id,
          scanId,
          severity: f.severity as any,
          title: f.title,
          description: f.whatItIs ?? f.description ?? "",
          filePath: f.filePath,
          lineNumber: f.lineNumber ?? null,
          cwe: f.cwe ?? null,
          rule: f.ruleId ?? f.rule ?? null,
          snippet: f.snippet ?? null,
          diffBefore: f.diffBefore ?? null,
          diffAfter: f.diffAfter ?? null,
          aiFix: f.fixExplanation ?? f.remediation ?? null,
          status: "OPEN",
        },
      });
    }

    // persist attack paths
    for (const ap of attackPaths) {
      try {
        await db.sentraAttackPath.create({
          data: {
            repoId: repo.id,
            scanId,
            title: ap.title,
            description: ap.description,
            severity:
              ap.severity === "CRITICAL"
                ? "CRITICAL"
                : ap.severity === "HIGH"
                  ? "HIGH"
                  : ap.severity === "MEDIUM"
                    ? "MEDIUM"
                    : "LOW",
            steps: ap.steps ?? [],
            affectedFiles: ap.affectedFiles ?? [],
            attackVector: ap.attackVector ?? null,
            cvssScore: ap.cvssScore ?? null,
            exploitability: ap.exploitability ?? null,
            businessImpact: ap.businessImpact ?? null,
            remediation: ap.remediation ?? null,
            cveIds: ap.cveIds ?? [],
          },
        });
      } catch (err) {
        console.warn("Failed to save attack path:", err);
      }
    }

    // persist agent run logs
    for (const run of agentRuns) {
      try {
        await db.sentraAgentRun.create({
          data: {
            scanId,
            agentType: run.agentType,
            durationMs: run.durationMs ?? 0,
            findingsIn: run.findingsIn ?? 0,
            findingsOut: run.findingsOut ?? 0,
          },
        });
      } catch {}
    }

    const summary = scanData.summary;
    const riskScore = computeRiskScore(summary.critical, summary.warning);
    const duration = Math.round((Date.now() - startTime) / 1000);

    await db.sentraScan.update({
      where: { id: scanId },
      data: {
        status: "COMPLETED",
        filesScanned: fileContents.length,
        findingsCount: summary.total,
        completedAt: new Date(),
        duration,
      },
    });

    await db.sentraRepo.update({
      where: { id: repo.id },
      data: {
        scanStatus: "COMPLETED",
        lastScanAt: new Date(),
        riskScore,
        totalCommits: commits.length,
      },
    });
  } catch (err) {
    console.error("Full scan failed:", err);
    await db.sentraScan.update({
      where: { id: scanId },
      data: {
        status: "FAILED",
        errorMessage: (err as Error).message,
        completedAt: new Date(),
      },
    });
    await db.sentraRepo.update({
      where: { id: repo.id },
      data: { scanStatus: "FAILED" },
    });
  }

  try {
    const gaps = await detectComplianceGaps(scanId, workspaceId);
    if (gaps.length > 0) {
      console.log(
        `AuditReady: detected ${gaps.length} compliance gaps from scan ${scanId}`,
      );
    }
  } catch (err) {
    console.warn("Compliance gap detection failed:", err);
  }
}

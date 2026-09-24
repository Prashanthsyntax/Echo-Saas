import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { fetchRepoPRs, fetchPRDiff } from "@/lib/github";
import { reviewPRDiff } from "@/lib/sentra-scanner";
import { requireSentraAuth } from "@/lib/sentra-cli-auth";

export async function GET(req: Request) {
  const ctx = await requireSentraAuth(req);
  if (!ctx)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId") ?? ctx.workspaceId;
  if (!workspaceId)
    return NextResponse.json(
      { error: "workspaceId required" },
      { status: 400 },
    );

  const settings = await db.sentraSettings.findUnique({
    where: { workspaceId },
  });
  const token = settings?.githubToken ?? undefined;

  const repos = await db.sentraRepo.findMany({ where: { workspaceId } });

  const allPRs: unknown[] = [];
  for (const repo of repos) {
    const prs = await fetchRepoPRs(repo.owner, repo.repoName, token);
    for (const pr of prs.slice(0, 3)) {
      allPRs.push({
        repoId: repo.id,
        repoName: repo.fullName,
        number: pr.number,
        title: pr.title,
        branch: pr.head.ref,
        author: pr.user.login,
        avatar: pr.user.avatar_url,
        verdict: "PENDING",
      });
    }
  }

  return NextResponse.json({ prs: allPRs });
}

// POST — run AI review on a specific PR
export async function POST(req: Request) {
  const ctx = await requireSentraAuth(req);
  if (!ctx)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const workspaceId = body.workspaceId ?? ctx.workspaceId;
  const repoId = body.repoId;
  const prNumberRaw = Number(body.prNumber);
  if (!Number.isInteger(prNumberRaw) || prNumberRaw <= 0) {
    return NextResponse.json({ error: "Invalid prNumber" }, { status: 400 });
  }
  const prNumber = prNumberRaw;

  const settings = await db.sentraSettings.findUnique({
    where: { workspaceId },
  });
  const token = settings?.githubToken ?? undefined;

  const repo = await db.sentraRepo.findUnique({ where: { id: repoId } });
  if (!repo)
    return NextResponse.json({ error: "Repo not found" }, { status: 404 });

  const prs = await fetchRepoPRs(repo.owner, repo.repoName, token);
  const pr = prs.find((p) => p.number === prNumber);
  if (!pr) return NextResponse.json({ error: "PR not found" }, { status: 404 });

  const diff = await fetchPRDiff(repo.owner, repo.repoName, prNumber, token);
  const review = await reviewPRDiff(diff, repo.fullName, pr.title);

  return NextResponse.json({
    review,
    pr: { title: pr.title, number: pr.number },
  });
}

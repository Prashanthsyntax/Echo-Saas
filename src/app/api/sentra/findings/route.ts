/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

async function getCliContext(req: Request) {
  const apiKey =
    req.headers.get("x-sentra-apikey") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!apiKey) return null;

  const key = await db.agentKey.findFirst({
    where: {
      keyHash: apiKey,
      isActive: true,
      provider: { startsWith: "cli:" },
    },
    include: {
      user: { select: { id: true, email: true } },
    },
  });

  if (!key) return null;

  return {
    userId: key.user.id,
    email: key.user.email,
    workspaceId: key.provider.replace("cli:", ""),
  };
}

async function requireSentraAuth(req: Request) {
  const cli = await getCliContext(req);
  if (cli) return cli;

  const { userId } = await auth();
  if (!userId) return null;

  return {
    userId,
    workspaceId: null,
  };
}

export async function GET(req: Request) {
  const ctx = await requireSentraAuth(req);

  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const workspaceId = searchParams.get("workspaceId") ?? ctx.workspaceId;
  const severity = searchParams.get("severity");
  const status = searchParams.get("status");
  const repoId = searchParams.get("repoId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const findings = await db.sentraFinding.findMany({
    where: {
      repo: { workspaceId },
      ...(severity ? { severity: severity as any } : {}),
      ...(status ? { status: status as any } : {}),
      ...(repoId ? { repoId } : {}),
      ...(searchParams.get("repoId") ? { repoId: searchParams.get("repoId")! } : {}),
    },
    include: {
      repo: {
        select: {
          fullName: true,
          owner: true,
          repoName: true,
        },
      },
    },
    orderBy: [
      { severity: "asc" },
      { createdAt: "desc" },
    ],
    take: 100,
  });

  return NextResponse.json({ findings });
}

export async function PATCH(req: Request) {
  const ctx = await requireSentraAuth(req);

  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { findingId, status, ignoreReason } = await req.json();

  const finding = await db.sentraFinding.update({
    where: { id: findingId },
    data: {
      status,
      ...(ignoreReason ? { ignoreReason } : {}),
      ...(status === "FIXED" ? { autoFixed: true } : {}),
    },
  });

  return NextResponse.json({ finding });
}
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  requireWorkspaceMembership,
  requireWorkspacePermission,
} from "@/lib/workspace-auth";

const CHROMA_URL = process.env.CHROMA_SERVICE_URL!;

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = req.headers.get("x-workspace-id")
    ?? new URL(req.url).searchParams.get("workspaceId")
    ?? null;

  const ragNamespace = workspaceId ?? userId;

  if (workspaceId) {
    const result = await requireWorkspaceMembership(workspaceId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
  }

  try {
    const res = await fetch(`${CHROMA_URL}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: ragNamespace }),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ documents: [], total_chunks: 0 });
    }

    const data = await res.json();
    const seen = new Set<string>();
    const deduped = (data.documents ?? []).filter((doc: { source: string }) => {
      if (seen.has(doc.source)) return false;
      seen.add(doc.source);
      return true;
    });

    return NextResponse.json({ ...data, documents: deduped });
  } catch {
    return NextResponse.json({ documents: [], total_chunks: 0 });
  }
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { source, workspaceId } = await req.json();
  const ragNamespace = workspaceId ?? userId;

  if (!source) {
    return NextResponse.json({ error: "source required" }, { status: 400 });
  }

  if (workspaceId) {
    const result = await requireWorkspacePermission(workspaceId, "DELETE_DOCUMENTS");
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
  }

  try {
    const res = await fetch(`${CHROMA_URL}/documents/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: ragNamespace, source }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: 502 });
    }

    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "RAG service unreachable" }, { status: 503 });
  }
}

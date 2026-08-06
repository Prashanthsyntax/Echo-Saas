import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";

const CHROMA_URL = process.env.CHROMA_SERVICE_URL!;

async function safeParseError(res: Response, fallback: string): Promise<string> {
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    return json.detail ?? json.error ?? fallback;
  } catch {
    return text.slice(0, 200) || fallback;
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = req.headers.get("x-workspace-id");

  // check permission
  if (workspaceId) {
    const user = await db.user.findUnique({ where: { clerkId: userId } });
    if (user) {
      const membership = await db.membership.findUnique({
        where: { userId_workspaceId: { userId: user.id, workspaceId } },
      });
      if (membership && !hasPermission(membership.role, "INGEST_DOCUMENTS")) {
        return NextResponse.json(
          { error: "Your role does not allow document ingestion" },
          { status: 403 }
        );
      }
    }
  }

  // use workspaceId as the RAG namespace — so all members share documents
  // fall back to userId for personal use outside a workspace
  const ragNamespace = workspaceId ?? userId;

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const upstream = new FormData();
    upstream.append("user_id", ragNamespace); // workspace namespace
    upstream.append("file", file, file.name);

    const res = await fetch(`${CHROMA_URL}/ingest/file`, {
      method: "POST",
      body: upstream,
    });

    if (!res.ok) {
      const errorMsg = await safeParseError(res, "File ingestion failed");
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    return NextResponse.json(await res.json());
  }

  const body = await req.json();

  if (body.url) {
    const res = await fetch(`${CHROMA_URL}/ingest/url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: ragNamespace, url: body.url }),
    });

    if (!res.ok) {
      const errorMsg = await safeParseError(res, "URL ingestion failed");
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    return NextResponse.json(await res.json());
  }

  if (body.content && body.source) {
    const res = await fetch(`${CHROMA_URL}/ingest/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: ragNamespace,
        content: body.content,
        source: body.source,
        source_type: body.source_type ?? "text",
      }),
    });

    if (!res.ok) {
      const errorMsg = await safeParseError(res, "Text ingestion failed");
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    return NextResponse.json(await res.json());
  }

  return NextResponse.json(
    { error: "Provide file, url, or content+source" },
    { status: 400 }
  );
}
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const CHROMA_URL = process.env.CHROMA_SERVICE_URL!;

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${CHROMA_URL}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Chroma /documents failed:", res.status);
      return NextResponse.json({ documents: [], total_chunks: 0 });
    }

    const data = await res.json();

    // de-duplicate by source as a safety net, in case Chroma still
    // returns stale duplicates while we track down the root cause
    const seen = new Set<string>();
    const deduped = (data.documents ?? []).filter((doc: { source: string }) => {
      if (seen.has(doc.source)) return false;
      seen.add(doc.source);
      return true;
    });

    return NextResponse.json({ ...data, documents: deduped });
  } catch (err) {
    console.error("Failed to reach Chroma service:", err);
    return NextResponse.json({ documents: [], total_chunks: 0 });
  }
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { source } = await req.json();

  if (!source) {
    return NextResponse.json({ error: "source required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${CHROMA_URL}/documents/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, source }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Chroma delete failed:", res.status, text);
      return NextResponse.json(
        { error: "Delete failed on RAG service", detail: text },
        { status: 502 }
      );
    }

    const data = await res.json();
    console.log("Delete result:", data);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Failed to reach Chroma service for delete:", err);
    return NextResponse.json(
      { error: "RAG service unreachable" },
      { status: 503 }
    );
  }
}
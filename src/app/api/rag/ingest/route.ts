import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const CHROMA_URL = process.env.CHROMA_SERVICE_URL!;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    // file upload — forward to Chroma service
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const upstream = new FormData();
    upstream.append("user_id", userId);
    upstream.append("file", file, file.name);

    const res = await fetch(`${CHROMA_URL}/ingest/file`, {
      method: "POST",
      body: upstream,
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.detail ?? "Ingestion failed" }, { status: 500 });
    }

    return NextResponse.json(await res.json());
  }

  // JSON body — URL or text
  const body = await req.json();

  if (body.url) {
    const res = await fetch(`${CHROMA_URL}/ingest/url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, url: body.url }),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.detail ?? "URL ingestion failed" }, { status: 500 });
    }

    return NextResponse.json(await res.json());
  }

  if (body.content && body.source) {
    const res = await fetch(`${CHROMA_URL}/ingest/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        content: body.content,
        source: body.source,
        source_type: body.source_type ?? "text",
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.detail ?? "Text ingestion failed" }, { status: 500 });
    }

    return NextResponse.json(await res.json());
  }

  return NextResponse.json(
    { error: "Provide file, url, or content+source" },
    { status: 400 }
  );
}
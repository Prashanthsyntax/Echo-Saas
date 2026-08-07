import { NextResponse } from "next/server";

const CHROMA_URL = process.env.CHROMA_SERVICE_URL;

export async function GET() {
  if (!CHROMA_URL) {
    return NextResponse.json(
      { ok: false, reason: "CHROMA_SERVICE_URL not configured" },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(`${CHROMA_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, reason: "Chroma service returned error" },
        { status: 503 }
      );
    }

    const data = await res.json();
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        reason:
          err instanceof Error && err.name === "TimeoutError"
            ? "Chroma service timed out — it may be cold-starting on Render"
            : "Cannot reach Chroma service",
      },
      { status: 503 }
    );
  }
}
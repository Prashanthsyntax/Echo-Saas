import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireWorkspaceMembership } from "@/lib/workspace-auth";

const PRESENCE_TIMEOUT_MS = 45 * 1000; // 45 seconds — removed if no heartbeat

// GET — SSE stream: client subscribes to presence updates
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const result = await requireWorkspaceMembership(workspaceId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // client disconnected
        }
      };

      // send initial presence snapshot
      const sendPresence = async () => {
        const cutoff = new Date(Date.now() - PRESENCE_TIMEOUT_MS);
        const sessions = await db.presenceSession.findMany({
          where: {
            workspaceId,
            lastSeen: { gte: cutoff },
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                imageUrl: true,
              },
            },
          },
        });

        send({
          type: "presence",
          users: sessions.map((s) => ({
            userId: s.userId,
            name: s.user.name ?? s.user.email,
            email: s.user.email,
            imageUrl: s.user.imageUrl,
            page: s.page,
            lastSeen: s.lastSeen,
          })),
        });
      };

      await sendPresence();

      // poll every 5 seconds and push updates
      const interval = setInterval(sendPresence, 5000);

      // heartbeat ping every 20s to keep connection alive
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(interval);
          clearInterval(ping);
        }
      }, 20000);

      // cleanup when client disconnects
      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        clearInterval(ping);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// POST — heartbeat: client sends current page every 30s
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { workspaceId, page } = await req.json();

  if (!workspaceId || !page) {
    return NextResponse.json(
      { error: "workspaceId and page required" },
      { status: 400 }
    );
  }

  const result = await requireWorkspaceMembership(workspaceId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  await db.presenceSession.upsert({
    where: { userId_workspaceId: { userId: result.user.id, workspaceId } },
    update: { page, lastSeen: new Date() },
    create: { userId: result.user.id, workspaceId, page },
  });

  return NextResponse.json({ success: true });
}

// DELETE — user explicitly leaves (tab close, logout)
export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: true });

  const { workspaceId } = await req.json().catch(() => ({}));

  if (!workspaceId) return NextResponse.json({ ok: true });

  const result = await requireWorkspaceMembership(workspaceId);
  if (!result.ok) return NextResponse.json({ ok: true });

  await db.presenceSession.deleteMany({
    where: { userId: result.user.id, workspaceId },
  });

  return NextResponse.json({ success: true });
}

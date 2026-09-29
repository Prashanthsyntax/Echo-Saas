import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workspaceId, sourceId, targetId, edgeType, label } = await req.json();

  const edge = await db.kGEdge.upsert({
    where: {
      sourceId_targetId_edgeType: { sourceId, targetId, edgeType: edgeType ?? "RELATED_TO" },
    },
    update: { label },
    create: {
      workspaceId,
      sourceId,
      targetId,
      edgeType:    edgeType ?? "RELATED_TO",
      label:       label ?? null,
      confidence:  1.0,
      extractedBy: "user",
    },
  });

  return NextResponse.json({ edge });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { edgeId } = await req.json();
  await db.kGEdge.delete({ where: { id: edgeId } });
  return NextResponse.json({ success: true });
}
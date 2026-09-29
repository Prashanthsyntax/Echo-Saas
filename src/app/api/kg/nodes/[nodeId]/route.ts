/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// PATCH — update node
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { nodeId } = await params;
  const body       = await req.json();

  // version before updating
  const existing = await db.kGNode.findUnique({ where: { id: nodeId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const versionCount = await db.kGNodeVersion.count({ where: { nodeId } });
  await db.kGNodeVersion.create({
    data: {
      nodeId,
      versionNum:  versionCount + 1,
      label:       existing.label,
      description: existing.description,
      nodeType:    existing.nodeType,
      confidence:  existing.confidence,
      aliases:     existing.aliases as any,
      changedBy:   "user",
      changeReason:body.reason ?? "Manual edit",
      snapshot:    existing as any,
    },
  });

  const updated = await db.kGNode.update({
    where: { id: nodeId },
    data: {
      ...(body.label       !== undefined && { label:       body.label       }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.nodeType    !== undefined && { nodeType:    body.nodeType    }),
      ...(body.color       !== undefined && { color:       body.color       }),
      ...(body.posX        !== undefined && { posX:        body.posX        }),
      ...(body.posY        !== undefined && { posY:        body.posY        }),
      ...(body.aliases     !== undefined && { aliases:     body.aliases     }),
      ...(body.status      !== undefined && { status:      body.status      }),
    },
  });

  return NextResponse.json({ node: updated });
}

// DELETE — soft delete
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { nodeId } = await params;
  await db.kGNode.update({
    where: { id: nodeId },
    data:  { status: "DELETED" },
  });

  return NextResponse.json({ success: true });
}
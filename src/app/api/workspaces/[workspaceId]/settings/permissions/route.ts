import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { requireWorkspacePermission } from "@/lib/workspace-auth";
import type { Role } from "@prisma/client";

// PATCH — update permission settings
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;

  const result = await requireWorkspacePermission(
    workspaceId,
    "UPDATE_SETTINGS"
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const { allowMemberInvite, allowMemberExport, defaultRole } =
    await req.json();

  const settings = await db.workspaceSettings.upsert({
    where: { workspaceId },
    update: {
      ...(allowMemberInvite !== undefined && { allowMemberInvite }),
      ...(allowMemberExport !== undefined && { allowMemberExport }),
      ...(defaultRole !== undefined && { defaultRole: defaultRole as Role }),
    },
    create: {
      workspaceId,
      allowMemberInvite: allowMemberInvite ?? false,
      allowMemberExport: allowMemberExport ?? true,
      defaultRole: (defaultRole as Role) ?? "VIEWER",
    },
  });

  return NextResponse.json({ settings });
}
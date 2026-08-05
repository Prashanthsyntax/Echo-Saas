import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { hasPermission, type Permission } from "./permissions";
import type { Role } from "@prisma/client";

type WorkspaceAuthResult = {
  ok: true;
  user: { id: string; clerkId: string; name: string | null; email: string };
  membership: { role: Role; workspaceId: string };
} | {
  ok: false;
  status: number;
  error: string;
}

// Use this in every API route that needs workspace permission checking
export async function requireWorkspacePermission(
  workspaceId: string,
  permission: Permission
): Promise<WorkspaceAuthResult> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    return { ok: false, status: 401, error: "User not found" };
  }

  const membership = await db.membership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId } },
  });

  if (!membership) {
    return { ok: false, status: 403, error: "Not a member of this workspace" };
  }

  if (!hasPermission(membership.role, permission)) {
    return {
      ok: false,
      status: 403,
      error: `Your role (${membership.role}) does not have permission to ${permission}`,
    };
  }

  return {
    ok: true,
    user,
    membership: { role: membership.role, workspaceId },
  };
}

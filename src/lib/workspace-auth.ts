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

type VideoAuthResult =
  | (Extract<WorkspaceAuthResult, { ok: true }> & {
      video: { id: string; workspaceId: string; userId: string };
    })
  | Extract<WorkspaceAuthResult, { ok: false }>;

async function getWorkspaceAuth(workspaceId: string): Promise<WorkspaceAuthResult> {
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

  return {
    ok: true,
    user,
    membership: { role: membership.role, workspaceId },
  };
}

// Use this in API routes that only need workspace membership checking.
export async function requireWorkspaceMembership(
  workspaceId: string
): Promise<WorkspaceAuthResult> {
  return getWorkspaceAuth(workspaceId);
}

// Use this in every API route that needs workspace permission checking.
export async function requireWorkspacePermission(
  workspaceId: string,
  permission: Permission
): Promise<WorkspaceAuthResult> {
  const result = await getWorkspaceAuth(workspaceId);

  if (!result.ok) {
    return result;
  }

  if (!hasPermission(result.membership.role, permission)) {
    return {
      ok: false,
      status: 403,
      error: `Your role (${result.membership.role}) does not have permission to ${permission}`,
    };
  }

  return result;
}

export async function requireVideoPermission(
  videoId: string,
  permission: Permission
): Promise<VideoAuthResult> {
  const video = await db.video.findUnique({
    where: { id: videoId },
    select: { id: true, workspaceId: true, userId: true },
  });

  if (!video) {
    return { ok: false, status: 404, error: "Video not found" };
  }

  const result = await requireWorkspacePermission(video.workspaceId, permission);

  if (!result.ok) {
    return result;
  }

  return { ...result, video };
}

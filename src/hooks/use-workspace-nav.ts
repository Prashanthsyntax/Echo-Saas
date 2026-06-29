"use client";

import { useWorkspace } from "@/lib/workspace-context";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function useWorkspaceNav() {
  const { workspaceId } = useWorkspace();
  const router = useRouter();

  const navigateWithWorkspace = useCallback(
    (path: string) => {
      if (workspaceId && path.startsWith("/dashboard")) {
        router.push(`${path}?workspace=${workspaceId}`);
      } else {
        router.push(path);
      }
    },
    [workspaceId, router]
  );

  return { navigateWithWorkspace, workspaceId };
}
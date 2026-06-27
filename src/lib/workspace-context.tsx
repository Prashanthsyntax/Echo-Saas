/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

interface WorkspaceContextValue {
  workspaceId: string | null;
  workspaceName: string;
  switchWorkspace: (id: string, name: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaceId: null,
  workspaceName: "",
  switchWorkspace: () => {},
});

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("echo_workspace_id");
    const savedName = localStorage.getItem("echo_workspace_name");
    if (saved) {
      setWorkspaceId(saved);
      setWorkspaceName(savedName ?? "");
    }
  }, []);

  const switchWorkspace = useCallback(
    (id: string, name: string) => {
      setWorkspaceId(id);
      setWorkspaceName(name);
      localStorage.setItem("echo_workspace_id", id);
      localStorage.setItem("echo_workspace_name", name);
      // refresh all server components so they re-fetch with new workspace
      router.refresh();
    },
    [router]
  );

  return (
    <WorkspaceContext.Provider value={{ workspaceId, workspaceName, switchWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
}
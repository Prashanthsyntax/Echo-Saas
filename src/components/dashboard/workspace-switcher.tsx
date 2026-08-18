"use client";

import { useState, useEffect, useRef } from "react";
import { Check, ChevronDown, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/lib/workspace-context";
import { workspaceStore } from "@/lib/workspace-store";
import type { Role } from "@prisma/client";

interface Workspace {
  id: string;
  name: string;
  plan: string;
  role: string;
  memberships: Array<{ user: { imageUrl: string | null } }>;
  _count: { videos: number };
}

interface WorkspaceSwitcherProps {
  onManage: (id: string, name: string, role: Role) => void;
}

export function WorkspaceSwitcher({ onManage }: WorkspaceSwitcherProps) {
  const { workspaceId, switchWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchWorkspaces = () => {
      fetch("/api/workspaces")
        .then((r) => r.json())
        .then((data) => {
          const list: Workspace[] = data.workspaces ?? [];
          setWorkspaces(list);
          const stored = workspaceStore?.get?.() ?? null;
          const active =
            stored && list.find((w) => w.id === stored)
              ? stored
              : (list[0]?.id ?? null);

          if (active) {
            const ws = list.find((w) => w.id === active);
            if (ws) switchWorkspace(ws.id, ws.name);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    };

    fetchWorkspaces();

    // re-fetch when user comes back to the tab
    // catches the case where they accepted an invite in another tab
    window.addEventListener("focus", fetchWorkspaces);
    return () => window.removeEventListener("focus", fetchWorkspaces);
  }, []); // eslint-disable-line

  // close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setShowCreate(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const activeWorkspace = workspaces.find((w) => w.id === workspaceId);

  const handleSelect = (ws: Workspace) => {
    switchWorkspace(ws.id, ws.name);
    setOpen(false);
  };

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Workspace create failed:", err.error ?? res.status);
        return;
      }
      const workspace: Workspace = await res.json();
      setWorkspaces((prev) => [...prev, workspace]);
      switchWorkspace(workspace.id, workspace.name);
      setNewName("");
      setShowCreate(false);
      setOpen(false);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-3 mb-4 flex h-10 items-center gap-2 rounded-lg bg-white/5 px-3">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30" />
        <span className="text-xs text-white/30">Loading workspaces...</span>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative mx-3 mb-4">
      {/* trigger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg bg-white/5 px-3 py-2.5 text-left transition-colors hover:bg-white/8"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-primary/20 text-xs font-bold text-primary">
            {activeWorkspace?.name?.[0]?.toUpperCase() ?? "W"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-white">
              {activeWorkspace?.name ?? "Select workspace"}
            </p>
            {activeWorkspace && (
              <p className="text-[10px] text-white/30">
                {activeWorkspace._count.videos} video
                {activeWorkspace._count.videos !== 1 ? "s" : ""} ·{" "}
                {activeWorkspace.plan}
              </p>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-white/30 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {/* dropdown */}
      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1 overflow-hidden rounded-xl border border-white/10"
          style={{
            backgroundColor: "#111114",
            boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
            zIndex: 9998,
          }}
        >
          {/* workspace list */}
          <div className="max-h-52 overflow-y-auto p-1">
            {workspaces.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-white/20">
                No workspaces yet
              </p>
            ) : (
              workspaces.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => handleSelect(ws)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/20 text-xs font-bold text-primary">
                    {ws.name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white">
                      {ws.name}
                    </p>
                    <p className="text-[10px] text-white/30">
                      {ws.memberships.length} member
                      {ws.memberships.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {ws.id === workspaceId && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>

          <div className="border-t border-white/8 p-1">
            {/* manage active workspace */}
            {activeWorkspace && (
              <button
                type="button"
                onClick={() => {
                  onManage(
                    activeWorkspace.id,
                    activeWorkspace.name,
                    activeWorkspace.role as Role,
                  );
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
              >
                Manage workspace →
              </button>
            )}

            {/* create new workspace */}
            {showCreate ? (
              <div className="px-2 py-2 space-y-2">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") {
                      setShowCreate(false);
                      setNewName("");
                    }
                  }}
                  placeholder="Workspace name..."
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:border-primary/50 focus:outline-none"
                />
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={creating || !newName.trim()}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/30 disabled:opacity-40"
                  >
                    {creating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Create workspace"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreate(false);
                      setNewName("");
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs text-white/30 transition-colors hover:text-white/60"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
              >
                <Plus className="h-3.5 w-3.5" />
                New workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

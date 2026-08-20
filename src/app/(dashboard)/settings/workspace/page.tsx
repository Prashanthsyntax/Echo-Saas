"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Save,
  AlertTriangle,
  Shield,
  Users,
  Settings,
  Crown,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_COLORS, ROLE_DESCRIPTIONS } from "@/lib/permissions";
import type { Role } from "@prisma/client";

interface WorkspaceInfo {
  id: string;
  name: string;
  description: string | null;
  plan: string;
  createdAt: string;
  _count: { memberships: number; videos: number };
}

interface WorkspaceSettings {
  allowMemberInvite: boolean;
  allowMemberExport: boolean;
  defaultRole: Role;
}

interface Member {
  userId: string;
  role: Role;
  user: { id: string; name: string | null; email: string };
}

const ROLES: Role[] = ["ADMIN", "EDITOR", "VIEWER"];

export default function WorkspaceSettingsPage() {
  const { workspaceId, workspaceName, switchWorkspace } = useWorkspace();
  const router = useRouter();

  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  // form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [generalSaved, setGeneralSaved] = useState(false);

  const [allowMemberInvite, setAllowMemberInvite] = useState(false);
  const [allowMemberExport, setAllowMemberExport] = useState(true);
  const [defaultRole, setDefaultRole] = useState<Role>("VIEWER");
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permissionsSaved, setPermissionsSaved] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [transferTo, setTransferTo] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    const load = async () => {
      setLoading(true);
      try {
        const [settingsRes, membersRes] = await Promise.all([
          fetch(`/api/workspaces/${workspaceId}/settings`),
          fetch(`/api/workspaces/${workspaceId}/members`),
        ]);

        const settingsData = await settingsRes.json();
        const membersData = await membersRes.json();

        setWorkspace(settingsData.workspace);
        setName(settingsData.workspace?.name ?? "");
        setDescription(settingsData.workspace?.description ?? "");

        if (settingsData.settings) {
          setSettings(settingsData.settings);
          setAllowMemberInvite(settingsData.settings.allowMemberInvite);
          setAllowMemberExport(settingsData.settings.allowMemberExport);
          setDefaultRole(settingsData.settings.defaultRole);
        }

        const allMembers: Member[] = membersData.members ?? [];
        setMembers(allMembers);

        // find current user's role
        const res = await fetch("/api/workspaces");
        const wsData = await res.json();
        const current = wsData.workspaces?.find(
          (w: { id: string; role: Role }) => w.id === workspaceId,
        );
        setCurrentUserRole(current?.role ?? null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [workspaceId]);

  const canEdit = currentUserRole === "OWNER" || currentUserRole === "ADMIN";
  const isOwner = currentUserRole === "OWNER";

  const handleSaveGeneral = async () => {
    if (!workspaceId || !name.trim()) return;
    setSavingGeneral(true);
    try {
      await fetch(`/api/workspaces/${workspaceId}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      setGeneralSaved(true);
      // update sidebar workspace name
      if (name.trim() !== workspaceName) {
        switchWorkspace(workspaceId, name.trim());
      }
      setTimeout(() => setGeneralSaved(false), 2000);
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!workspaceId) return;
    setSavingPermissions(true);
    try {
      await fetch(`/api/workspaces/${workspaceId}/settings/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowMemberInvite,
          allowMemberExport,
          defaultRole,
        }),
      });
      setPermissionsSaved(true);
      setTimeout(() => setPermissionsSaved(false), 2000);
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleTransfer = async () => {
    if (!workspaceId || !transferTo) return;
    setTransferring(true);
    setTransferError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newOwnerId: transferTo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTransferError(data.error ?? "Transfer failed");
        return;
      }
      // current user is now ADMIN — refresh
      setCurrentUserRole("ADMIN");
      setTransferTo("");
      const membersRes = await fetch(`/api/workspaces/${workspaceId}/members`);
      const membersData = await membersRes.json();
      setMembers(membersData.members ?? []);
    } finally {
      setTransferring(false);
    }
  };

  const handleDelete = async () => {
    if (!workspaceId || deleteConfirm !== workspace?.name) return;
    setDeleting(true);
    try {
      await fetch(`/api/workspaces/${workspaceId}/delete`, {
        method: "DELETE",
      });
      // redirect to overview — workspace is gone
      router.push("/overview");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/30" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-white/30">Workspace not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-full p-8">
      <div className="mx-auto max-w-2xl space-y-10">
        {/* page header */}
        <div>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-white/40" />
            <h1 className="text-xl font-bold text-white">Workspace Settings</h1>
          </div>
          <p className="mt-1 text-sm text-white/30">
            Manage settings and permissions for{" "}
            <span className="text-white/60">{workspace.name}</span>
          </p>
        </div>

        {/* workspace stats strip */}
        <div
          className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/5"
          style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
        >
          {[
            { label: "Members", value: workspace._count.memberships },
            { label: "Videos", value: workspace._count.videos },
            {
              label: "Plan",
              value: (
                <Badge
                  className="border-0 text-[10px]"
                  style={
                    workspace.plan === "PRO"
                      ? {
                          backgroundColor: "rgba(139,92,246,0.2)",
                          color: "#a78bfa",
                        }
                      : {
                          backgroundColor: "rgba(255,255,255,0.08)",
                          color: "rgba(255,255,255,0.4)",
                        }
                  }
                >
                  {workspace.plan}
                </Badge>
              ),
            },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1 px-5 py-4">
              <p className="text-[10px] font-medium uppercase tracking-widest text-white/20">
                {stat.label}
              </p>
              <p className="text-xl font-semibold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* ── SECTION: General ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-white/30" />
            <h2 className="text-sm font-semibold text-white">General</h2>
          </div>
          <Separator className="bg-white/5" />

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/40">
                Workspace name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit}
                placeholder="My workspace"
                className="border-white/10 bg-white/5 text-white placeholder:text-white/20 focus-visible:ring-primary/50 disabled:opacity-40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/40">
                Description <span className="text-white/20">(optional)</span>
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!canEdit}
                placeholder="What this workspace is for..."
                rows={3}
                className="resize-none border-white/10 bg-white/5 text-sm text-white placeholder:text-white/20 focus-visible:ring-primary/50 disabled:opacity-40"
              />
            </div>

            {canEdit && (
              <Button
                onClick={handleSaveGeneral}
                disabled={savingGeneral || !name.trim()}
                size="sm"
                className="gap-2"
              >
                {savingGeneral ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {generalSaved ? "Saved ✓" : "Save changes"}
              </Button>
            )}
          </div>
        </section>

        {/* ── SECTION: Member Permissions ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-white/30" />
            <h2 className="text-sm font-semibold text-white">
              Member Permissions
            </h2>
          </div>
          <Separator className="bg-white/5" />

          <div className="space-y-4">
            {/* Toggle rows */}
            {[
              {
                label: "Allow members to invite others",
                description:
                  "Editors and Viewers can send workspace invites (not just Owners and Admins)",
                value: allowMemberInvite,
                onChange: setAllowMemberInvite,
              },
              {
                label: "Allow members to export data",
                description:
                  "Members can export canvas as PNG, download transcripts, and export knowledge graphs",
                value: allowMemberExport,
                onChange: setAllowMemberExport,
              },
            ].map((toggle) => (
              <div
                key={toggle.label}
                className="flex items-start justify-between gap-4 rounded-xl border border-white/5 p-4"
                style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-white/70">
                    {toggle.label}
                  </p>
                  <p className="mt-0.5 text-xs text-white/30">
                    {toggle.description}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => {
                    if (canEdit) toggle.onChange(!toggle.value);
                  }}
                  className={cn(
                    "relative h-5 w-9 flex-shrink-0 rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40",
                    toggle.value ? "bg-primary" : "bg-white/10",
                  )}
                >
                  <span
                    className={cn(
                      "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
                      toggle.value ? "translate-x-4" : "translate-x-0",
                    )}
                  />
                </button>
              </div>
            ))}

            {/* default role */}
            <div
              className="space-y-2 rounded-xl border border-white/5 p-4"
              style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
            >
              <div>
                <p className="text-sm font-medium text-white/70">
                  Default role for new members
                </p>
                <p className="mt-0.5 text-xs text-white/30">
                  Role automatically assigned when someone accepts an invite
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setDefaultRole(role)}
                    className={cn(
                      "flex flex-col gap-1 rounded-xl border p-3 text-left transition-all disabled:opacity-40",
                      defaultRole === role
                        ? ROLE_COLORS[role]
                        : "border-white/8 text-white/30 hover:border-white/15",
                    )}
                  >
                    <p className="text-xs font-semibold capitalize">
                      {role.toLowerCase()}
                    </p>
                    <p className="text-[10px] leading-relaxed opacity-70">
                      {ROLE_DESCRIPTIONS[role].split("—")[1]?.trim() ??
                        ROLE_DESCRIPTIONS[role]}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {canEdit && (
              <Button
                onClick={handleSavePermissions}
                disabled={savingPermissions}
                size="sm"
                className="gap-2"
              >
                {savingPermissions ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Shield className="h-3.5 w-3.5" />
                )}
                {permissionsSaved ? "Saved ✓" : "Save permissions"}
              </Button>
            )}
          </div>
        </section>

        {/* ── SECTION: Role Reference ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-white/30" />
            <h2 className="text-sm font-semibold text-white">Role Reference</h2>
          </div>
          <Separator className="bg-white/5" />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(["OWNER", "ADMIN", "EDITOR", "VIEWER"] as Role[]).map((role) => (
              <div
                key={role}
                className={cn(
                  "rounded-xl border p-4 space-y-2",
                  currentUserRole === role
                    ? ROLE_COLORS[role]
                    : "border-white/5",
                )}
                style={
                  currentUserRole !== role
                    ? { backgroundColor: "rgba(255,255,255,0.02)" }
                    : undefined
                }
              >
                <div className="flex items-center gap-2">
                  {role === "OWNER" && (
                    <Crown className="h-3.5 w-3.5 text-amber-400" />
                  )}
                  <p className="text-xs font-semibold capitalize text-white">
                    {role.toLowerCase()}
                  </p>
                  {currentUserRole === role && (
                    <span className="ml-auto text-[10px] opacity-60">
                      Your role
                    </span>
                  )}
                </div>
                <p className="text-[11px] leading-relaxed text-white/40">
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION: Danger Zone (OWNER only) ── */}
        {isOwner && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <h2 className="text-sm font-semibold text-red-400">
                Danger Zone
              </h2>
            </div>
            <Separator className="bg-red-500/20" />

            <div className="space-y-4">
              {/* Transfer ownership */}
              <div
                className="space-y-3 rounded-xl border border-red-500/15 p-5"
                style={{ backgroundColor: "rgba(239,68,68,0.04)" }}
              >
                <div>
                  <p className="text-sm font-medium text-white/80">
                    Transfer ownership
                  </p>
                  <p className="mt-0.5 text-xs text-white/30">
                    Transfer this workspace to another member. You will become
                    an Admin.
                  </p>
                </div>

                {members.filter((m) => m.role !== "OWNER").length === 0 ? (
                  <p className="text-xs text-white/20">
                    No other members to transfer to. Invite someone first.
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select
                        value={transferTo}
                        onChange={(e) => setTransferTo(e.target.value)}
                        className="w-full appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 pr-7 text-xs text-white/60 focus:border-primary/50 focus:outline-none"
                      >
                        <option value="">Select new owner...</option>
                        {members
                          .filter((m) => m.role !== "OWNER")
                          .map((m) => (
                            <option
                              key={m.user.id}
                              value={m.user.id}
                              className="bg-[#111] text-white"
                            >
                              {m.user.name ?? m.user.email} ({m.role})
                            </option>
                          ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/30" />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTransfer}
                      disabled={!transferTo || transferring}
                      className="shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      {transferring ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Transfer"
                      )}
                    </Button>
                  </div>
                )}
                {transferError && (
                  <p className="text-xs text-red-400">{transferError}</p>
                )}
              </div>

              {/* Delete workspace */}
              <div
                className="space-y-3 rounded-xl border border-red-500/30 p-5"
                style={{ backgroundColor: "rgba(239,68,68,0.06)" }}
              >
                <div>
                  <p className="text-sm font-medium text-red-400">
                    Delete workspace
                  </p>
                  <p className="mt-0.5 text-xs text-white/30">
                    Permanently delete{" "}
                    <span className="font-medium text-white/60">
                      {workspace.name}
                    </span>{" "}
                    and all its content — videos, chat history, knowledge
                    graphs, canvas, and members. This cannot be undone.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-white/40">
                    Type{" "}
                    <span className="font-mono text-white/60">
                      {workspace.name}
                    </span>{" "}
                    to confirm
                  </label>
                  <Input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder={workspace.name}
                    className="border-red-500/20 bg-red-500/5 text-white placeholder:text-white/10 focus-visible:ring-red-500/30"
                  />
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteConfirm !== workspace.name || deleting}
                  className="gap-2"
                >
                  {deleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  )}
                  Delete workspace permanently
                </Button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

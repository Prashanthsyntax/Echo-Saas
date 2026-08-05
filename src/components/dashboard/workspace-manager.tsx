/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X, UserPlus, Trash2, Check, Crown,
  Loader2, RefreshCw, ChevronDown, Activity,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  ROLE_COLORS,
  ROLE_DESCRIPTIONS,
  ROLE_HIERARCHY,
} from "@/lib/permissions";
import type { Role } from "@prisma/client";

interface Member {
  userId: string;
  role: Role;
  user: {
    id: string;
    name: string | null;
    email: string;
    imageUrl: string | null;
  };
}

interface Invite {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  accepted: boolean;
}

interface Activity {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  user: {
    name: string | null;
    email: string;
    imageUrl: string | null;
  };
}

interface WorkspaceManagerProps {
  workspaceId: string;
  workspaceName: string;
  currentUserRole: Role;
  onClose: () => void;
}

type Tab = "members" | "invites" | "activity";

const ROLES: Role[] = ["OWNER", "ADMIN", "EDITOR", "VIEWER"];

const ACTIVITY_ICONS: Record<string, string> = {
  MEMBER_JOINED: "👋",
  MEMBER_LEFT: "🚪",
  MEMBER_REMOVED: "❌",
  MEMBER_ROLE_CHANGED: "🔄",
  VIDEO_UPLOADED: "🎥",
  VIDEO_DELETED: "🗑️",
  DOCUMENT_INGESTED: "📄",
  KNOWLEDGE_GRAPH_CREATED: "🧠",
  CANVAS_UPDATED: "🎨",
  WORKFLOW_CREATED: "⚡",
  WORKSPACE_RENAMED: "✏️",
  INVITE_SENT: "📧",
  CHAT_MESSAGE_SENT: "💬",
};

export function WorkspaceManager({
  workspaceId,
  workspaceName,
  currentUserRole,
  onClose,
}: WorkspaceManagerProps) {
  const [mounted, setMounted] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("VIEWER");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("members");
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const fetchMembers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/members`,
        { cache: "no-store", headers: { "Cache-Control": "no-cache" } }
      );
      const data = await res.json();
      setMembers(data.members ?? []);
      setInvites((data.invites ?? []).filter((i: Invite) => !i.accepted));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [workspaceId]);

  const fetchActivities = useCallback(async () => {
    setActivitiesLoading(true);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/activity?limit=20`
      );
      const data = await res.json();
      setActivities(data.activities ?? []);
    } finally {
      setActivitiesLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchMembers(false);
  }, [fetchMembers]);

  useEffect(() => {
    if (activeTab === "activity") {
      fetchActivities();
    }
  }, [activeTab, fetchActivities]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error ?? "Failed to send invite");
        return;
      }
      setInvites((prev) => [...prev, data.invite]);
      setInviteEmail("");
      setActiveTab("invites");
      if (data.inviteLink) {
        navigator.clipboard.writeText(data.inviteLink);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 4000);
      }
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: Role) => {
    setChangingRole(memberId);
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/members/role`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId, newRole }),
        }
      );
      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) =>
            m.user.id === memberId ? { ...m, role: newRole } : m
          )
        );
      }
    } finally {
      setChangingRole(null);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Remove this member from the workspace?")) return;
    await fetch(`/api/workspaces/${workspaceId}/members`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });
    setMembers((prev) => prev.filter((m) => m.user.id !== memberId));
  };

  const canManageMember = (targetRole: Role) => {
    return ROLE_HIERARCHY[currentUserRole] > ROLE_HIERARCHY[targetRole];
  };

  const pendingInvites = invites.filter((i) => !i.accepted);

  const modalContent = (
    <div className="fixed inset-0" style={{ zIndex: 9999 }}>
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div
        className="absolute left-1/2 top-1/2 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/15"
        style={{
          backgroundColor: "#111114",
          boxShadow: "0 30px 80px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.06)",
          zIndex: 10000,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">{workspaceName}</h2>
            <p className="mt-0.5 text-xs text-white/30">
              {members.length} member{members.length !== 1 ? "s" : ""}
              {pendingInvites.length > 0 &&
                ` · ${pendingInvites.length} pending`}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => fetchMembers(true)}
              disabled={refreshing || loading}
              className="rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/5 hover:text-white/60 disabled:opacity-30"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="rounded-xl p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <Separator className="bg-white/8 shrink-0" />

        {/* Invite section — only for OWNER/ADMIN */}
        {(currentUserRole === "OWNER" || currentUserRole === "ADMIN") && (
          <>
            <div className="space-y-2 px-6 py-4 shrink-0">
              <p className="text-xs font-medium text-white/40">
                Invite teammate
              </p>
              <div className="flex gap-2">
                <Input
                  value={inviteEmail}
                  onChange={(e) => {
                    setInviteEmail(e.target.value);
                    setInviteError(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  placeholder="teammate@company.com"
                  className="flex-1 border-white/10 bg-white/5 text-sm text-white placeholder:text-white/20 focus-visible:ring-primary/50"
                />

                {/* Role selector */}
                <div className="relative">
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as Role)}
                    className="appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 pr-7 text-xs text-white/60 focus:border-primary/50 focus:outline-none"
                  >
                    <option value="VIEWER">Viewer</option>
                    <option value="EDITOR">Editor</option>
                    {currentUserRole === "OWNER" && (
                      <>
                        <option value="ADMIN">Admin</option>
                      </>
                    )}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/30" />
                </div>

                <Button
                  type="button"
                  onClick={handleInvite}
                  disabled={inviting || !inviteEmail.trim()}
                  size="sm"
                  className="shrink-0 gap-1.5"
                >
                  {inviting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" />
                  )}
                  Invite
                </Button>
              </div>

              {inviteError && (
                <p className="text-xs text-red-400">{inviteError}</p>
              )}
              {copiedLink && (
                <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                  <Check className="h-3 w-3 shrink-0 text-emerald-400" />
                  <p className="text-xs text-emerald-400">
                    Invite link copied — share with your teammate
                  </p>
                </div>
              )}
            </div>
            <Separator className="bg-white/8 shrink-0" />
          </>
        )}

        {/* Tabs */}
        <div className="flex border-b border-white/8 shrink-0">
          {(["members", "invites", "activity"] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2.5 text-xs font-medium capitalize transition-colors",
                activeTab === tab
                  ? "border-b-2 border-primary text-primary"
                  : "text-white/30 hover:text-white/60"
              )}
            >
              {tab}
              {tab === "members" && (
                <span className="ml-1.5 rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] text-white/30">
                  {members.length}
                </span>
              )}
              {tab === "invites" && pendingInvites.length > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400">
                  {pendingInvites.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <Loader2 className="h-5 w-5 animate-spin text-white/20" />
              <p className="text-xs text-white/20">Loading members...</p>
            </div>
          ) : activeTab === "members" ? (
            <div className="divide-y divide-white/5">
              {members.map((m) => (
                <div key={m.userId} className="flex items-center gap-3 px-6 py-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={m.user.imageUrl ?? ""} />
                    <AvatarFallback className="bg-white/5 text-xs text-white/40">
                      {(m.user.name?.[0] ?? m.user.email[0]).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-white">
                      {m.user.name ?? m.user.email}
                    </p>
                    <p className="truncate text-[11px] text-white/30">
                      {m.user.email}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {m.role === "OWNER" ? (
                      <>
                        <Crown className="h-3 w-3 text-amber-400" />
                        <Badge
                          variant="outline"
                          className={cn("border text-[10px] capitalize", ROLE_COLORS[m.role])}
                        >
                          owner
                        </Badge>
                      </>
                    ) : canManageMember(m.role) ? (
                      // Role dropdown for manageable members
                      <div className="relative">
                        <select
                          value={m.role}
                          onChange={(e) =>
                            handleRoleChange(m.user.id, e.target.value as Role)
                          }
                          disabled={changingRole === m.user.id}
                          className={cn(
                            "appearance-none rounded-lg border px-2 py-1 pr-5 text-[10px] focus:outline-none",
                            ROLE_COLORS[m.role],
                            "border-current/30 bg-transparent"
                          )}
                        >
                          {ROLES.filter((r) => r !== "OWNER").map((r) => (
                            <option
                              key={r}
                              value={r}
                              className="bg-[#111] text-white"
                            >
                              {r.charAt(0) + r.slice(1).toLowerCase()}
                            </option>
                          ))}
                        </select>
                        {changingRole === m.user.id ? (
                          <Loader2 className="pointer-events-none absolute right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 animate-spin" />
                        ) : (
                          <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2" />
                        )}
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className={cn("border text-[10px] capitalize", ROLE_COLORS[m.role])}
                      >
                        {m.role.toLowerCase()}
                      </Badge>
                    )}

                    {m.role !== "OWNER" && canManageMember(m.role) && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.user.id)}
                        className="rounded p-1 text-white/20 transition-colors hover:bg-red-500/10 hover:text-red-400"
                        title="Remove member"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : activeTab === "invites" ? (
            <div className="divide-y divide-white/5">
              {pendingInvites.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-white/20">No pending invites</p>
                  <p className="mt-1 text-xs text-white/10">
                    Invite a teammate using the form above
                  </p>
                </div>
              ) : (
                pendingInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center gap-3 px-6 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs text-white/30">
                      {invite.email[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-white/60">
                        {invite.email}
                      </p>
                      <p className="text-[11px] text-white/20">
                        Sent{" "}
                        {new Date(invite.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        · expires in 7 days
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant="outline"
                        className={cn(
                          "border text-[10px] capitalize",
                          ROLE_COLORS[invite.role]
                        )}
                      >
                        {invite.role.toLowerCase()}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-amber-500/20 text-[10px] text-amber-400/60"
                      >
                        Pending
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            // Activity feed
            <div className="divide-y divide-white/5">
              {activitiesLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-white/20" />
                </div>
              ) : activities.length === 0 ? (
                <div className="py-10 text-center">
                  <Activity className="mx-auto h-6 w-6 text-white/10" />
                  <p className="mt-3 text-sm text-white/20">No activity yet</p>
                  <p className="mt-1 text-xs text-white/10">
                    Actions taken in this workspace will appear here
                  </p>
                </div>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 px-6 py-3">
                    <span className="mt-0.5 text-base shrink-0">
                      {ACTIVITY_ICONS[activity.type] ?? "📌"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white/60">
                        <span className="font-medium text-white/80">
                          {activity.user.name ?? activity.user.email}
                        </span>{" "}
                        {activity.description}
                      </p>
                      <p className="mt-0.5 text-[10px] text-white/20">
                        {new Date(activity.createdAt).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 px-6 py-3 shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-white/15">
              {currentUserRole === "OWNER" || currentUserRole === "ADMIN"
                ? "Click ↻ after a teammate accepts their invite to see them here"
                : `Your role: ${currentUserRole.charAt(0) + currentUserRole.slice(1).toLowerCase()}`}
            </p>
            <div className="flex gap-2 text-[10px] text-white/15">
              {ROLES.map((r) => (
                <span key={r} className={cn("rounded px-1.5 py-0.5 border", ROLE_COLORS[r])}>
                  {r.charAt(0) + r.slice(1).toLowerCase()}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
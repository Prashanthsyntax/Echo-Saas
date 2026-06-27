/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X, UserPlus, Trash2, Check, Crown, Loader2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface Member {
  userId: string;
  role: string;
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
  createdAt: string;
}

interface WorkspaceManagerProps {
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
}

export function WorkspaceManager({
  workspaceId,
  workspaceName,
  onClose,
}: WorkspaceManagerProps) {
  const [mounted, setMounted] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<"members" | "invites">("members");

  // Mount guard for SSR (Next.js)
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    fetch(`/api/workspaces/${workspaceId}/members`)
      .then((r) => r.json())
      .then((data) => {
        setMembers(data.members ?? []);
        setInvites(data.invites ?? []);
        setLoading(false);
      });
  }, [workspaceId]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error ?? "Failed to send invite");
        return;
      }
      setInvites((prev) => [...prev, data.invite]);
      setInviteEmail("");
      if (data.inviteLink) {
        navigator.clipboard.writeText(data.inviteLink);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 3000);
      }
    } finally {
      setInviting(false);
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

  const roleBadgeStyle: Record<string, string> = {
    OWNER: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    ADMIN: "bg-violet-500/20 text-violet-400 border-violet-500/30",
    MEMBER: "bg-white/8 text-white/40 border-white/10",
  };

  const modalContent = (
    <div
      className="fixed inset-0"
      style={{ zIndex: 9999 }}
    >
      {/* Solid dark backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* Modal — centered, portaled to body so no parent clips it */}
      <div
        className="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/15"
        style={{
          backgroundColor: "#111114",
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.06)",
          zIndex: 10000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-white">
              {workspaceName}
            </h2>
            <p className="mt-0.5 text-xs text-white/30">
              {members.length} member{members.length !== 1 ? "s" : ""}
              {invites.length > 0 && ` · ${invites.length} pending`}
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="rounded-xl p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <Separator className="bg-white/8" />

        {/* Invite input */}
        <div className="px-6 py-4 space-y-2">
          <p className="text-xs font-medium text-white/40">
            Invite teammate by email
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
            <Button
              type="button"
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              size="sm"
              className="gap-1.5 shrink-0"
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
            <p className="flex items-center gap-1.5 text-xs text-emerald-400">
              <Check className="h-3 w-3" />
              Invite link copied to clipboard — share it with your teammate
            </p>
          )}
        </div>

        <Separator className="bg-white/8" />

        {/* Tabs */}
        <div className="flex border-b border-white/8">
          {(["members", "invites"] as const).map((tab) => (
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
              {tab === "invites" && invites.length > 0 && (
                <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/40">
                  {invites.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-white/20" />
            </div>
          ) : activeTab === "members" ? (
            <div className="divide-y divide-white/5">
              {members.map((m) => (
                <div
                  key={m.userId}
                  className="flex items-center gap-3 px-6 py-3"
                >
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
                    {m.role === "OWNER" && (
                      <Crown className="h-3 w-3 text-amber-400" />
                    )}
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] capitalize border",
                        roleBadgeStyle[m.role]
                      )}
                    >
                      {m.role.toLowerCase()}
                    </Badge>
                    {m.role !== "OWNER" && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.user.id)}
                        className="rounded p-1 text-white/20 transition-colors hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {invites.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-white/20">No pending invites</p>
                  <p className="mt-1 text-xs text-white/10">
                    Invite a teammate using the form above
                  </p>
                </div>
              ) : (
                invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center gap-3 px-6 py-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-xs text-white/30 shrink-0">
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
                        })}
                        {" · expires in 7 days"}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="shrink-0 text-[10px] border-white/10 text-white/20"
                    >
                      Pending
                    </Badge>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Don't render on the server (SSR guard), then portal to body
  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
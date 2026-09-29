/* eslint-disable react-hooks/refs */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import { useWorkspace } from "@/lib/workspace-context";
import { usePusherChat, type ChatMessage } from "@/hooks/use-pusher-chat";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Inbox, Send, Star, Archive, Plus, Search, Paperclip, Smile, BarChart2,
  Code2, Reply, Trash2, Edit3, CheckCheck, Loader2, Sparkles, X, Users,
  Menu, PanelLeftClose, PanelLeftOpen, ArrowUp,
} from "lucide-react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { formatDistanceToNow, format } from "date-fns";

/* ─── helpers ─────────────────────────────────────────────────────── */
const initials = (name: string | null, email: string) =>
  (name ?? email).split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
const timeAgo = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true });
const formatTime = (iso: string) => format(new Date(iso), "h:mm a");
function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return format(d, "MMM d, yyyy");
}
function dedupeConversations(list: any[]) {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const c of list) {
    if (!c?.id || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out;
}
function upsertConversation(list: any[], conv: any) {
  if (!conv?.id) return list;
  return [conv, ...list.filter((c) => c.id !== conv.id)];
}

const NAV_ITEMS = [
  { id: "inbox", label: "Inbox", Icon: Inbox },
  { id: "sent", label: "Sent", Icon: Send },
  { id: "starred", label: "Starred", Icon: Star },
  { id: "archived", label: "Archived", Icon: Archive },
];

const iconBtn =
  "rounded-lg p-1.5 text-white/30 hover:bg-white/8 hover:text-white/70 transition-colors";
const field =
  "w-full rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2.5 text-[13px] text-white placeholder:text-white/20 focus:border-white/20 focus:outline-none transition-colors";

/* ─── Avatar ──────────────────────────────────────────────────────── */
function UserAvatar({ name, email, imageUrl, size = "sm" }: {
  name: string | null; email: string; imageUrl?: string | null; size?: "xs" | "sm" | "md";
}) {
  const sizes = { xs: "h-6 w-6 text-[9px]", sm: "h-8 w-8 text-[10px]", md: "h-9 w-9 text-[11px]" };
  return (
    <Avatar className={cn(sizes[size], "shrink-0")}>
      <AvatarImage src={imageUrl ?? ""} />
      <AvatarFallback className={cn(sizes[size], "bg-white/10 text-white/60 font-medium")}>
        {initials(name, email)}
      </AvatarFallback>
    </Avatar>
  );
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3">
      <div className="h-px flex-1 bg-white/[0.06]" />
      <span className="text-[10.5px] text-white/25">{label}</span>
      <div className="h-px flex-1 bg-white/[0.06]" />
    </div>
  );
}

/* ─── Poll bubble ─────────────────────────────────────────────────── */
function PollBubble({ poll }: { poll: any }) {
  const [voting, setVoting] = useState(false);
  const total = poll.options.reduce((s: number, o: any) => s + o.votes.length, 0);
  const vote = async (optionId: string) => {
    setVoting(true);
    try {
      await fetch(`/api/workspace-chat/polls/${poll.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIds: [optionId] }),
      });
    } finally {
      setVoting(false);
    }
  };
  return (
    <div className="min-w-[240px] max-w-[300px] space-y-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center gap-2">
        <BarChart2 className="h-3.5 w-3.5 shrink-0 text-white/40" />
        <p className="text-[12.5px] font-medium text-white/80">{poll.question}</p>
      </div>
      <div className="space-y-1.5">
        {poll.options.map((opt: any) => {
          const pct = total > 0 ? Math.round((opt.votes.length / total) * 100) : 0;
          return (
            <button
              key={opt.id}
              onClick={() => vote(opt.id)}
              disabled={voting}
              className="relative w-full overflow-hidden rounded-xl border border-white/8 px-3 py-2 text-left transition-colors hover:border-white/20"
            >
              <div className="absolute inset-y-0 left-0 rounded-xl bg-white/6 transition-all" style={{ width: `${pct}%` }} />
              <div className="relative flex items-center justify-between">
                <span className="text-[12px] text-white/60">{opt.text}</span>
                <span className="font-mono text-[11px] text-white/30">{pct}%</span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-[10.5px] text-white/20">{total} vote{total !== 1 ? "s" : ""}</p>
    </div>
  );
}

/* ─── Message bubble ──────────────────────────────────────────────── */
function MessageBubble({ msg, isOwn, showAvatar, currentUserId, onReact, onReply, onEdit, onDelete }: {
  msg: ChatMessage; isOwn: boolean; showAvatar: boolean; currentUserId: string;
  onReact: (id: string, emoji: string) => void;
  onReply: (msg: ChatMessage) => void;
  onEdit: (msg: ChatMessage) => void;
  onDelete: (id: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const grouped = useMemo(() => {
    const map: Record<string, { count: number; mine: boolean }> = {};
    for (const r of msg.reactions ?? []) {
      if (!map[r.emoji]) map[r.emoji] = { count: 0, mine: false };
      map[r.emoji].count++;
      if (r.user.id === currentUserId) map[r.emoji].mine = true;
    }
    return map;
  }, [msg.reactions, currentUserId]);

  const readCount = (msg.readReceipts ?? []).filter((r) => r.userId !== currentUserId).length;
  const replies = msg._count?.replies ?? 0;

  if (msg.isDeleted) {
    return (
      <div className={cn("mx-auto flex max-w-3xl gap-3 px-5 py-0.5", isOwn && "flex-row-reverse")}>
        <div className="w-8 shrink-0" />
        <p className="rounded-2xl border border-white/8 px-3 py-1.5 text-[12px] italic text-white/20">
          This message was deleted
        </p>
      </div>
    );
  }

  return (
    <div className="group relative transition-colors hover:bg-white/[0.012]">
      <div className={cn("relative mx-auto flex max-w-3xl gap-3 px-5 py-0.5", isOwn && "flex-row-reverse")}>
        <div className="w-8 shrink-0 self-end">
          {showAvatar && (
            <UserAvatar name={msg.sender.name} email={msg.sender.email} imageUrl={msg.sender.imageUrl} />
          )}
        </div>

        <div className={cn("flex min-w-0 max-w-[75%] flex-col gap-1", isOwn && "items-end")}>
          {showAvatar && (
            <div className={cn("flex items-baseline gap-2 px-1", isOwn && "flex-row-reverse")}>
              <span className="text-[12px] font-semibold text-white/70">
                {isOwn ? "You" : (msg.sender.name ?? msg.sender.email.split("@")[0])}
              </span>
              <span className="text-[10px] text-white/20">{formatTime(msg.createdAt)}</span>
            </div>
          )}

          {msg.type === "CODE" ? (
            <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-black/50">
              <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
                <Code2 className="h-3 w-3 text-white/30" />
                <span className="font-mono text-[10.5px] text-white/30">{msg.metadata?.language ?? "code"}</span>
              </div>
              <pre className="overflow-x-auto px-4 py-3 font-mono text-[12px] leading-relaxed text-white/70">
                {msg.content}
              </pre>
            </div>
          ) : msg.type === "POLL" && msg.poll ? (
            <PollBubble poll={msg.poll} />
          ) : (
            <div
              className={cn(
                "break-words whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[13.5px] leading-relaxed",
                isOwn
                  ? "rounded-br-sm bg-white text-black"
                  : "rounded-bl-sm border border-white/[0.07] bg-white/[0.07] text-white/85",
              )}
            >
              {msg.content}
              {msg.isEdited && (
                <span className={cn("ml-1.5 text-[10px]", isOwn ? "text-black/35" : "text-white/25")}>(edited)</span>
              )}
            </div>
          )}

          {(msg.attachments ?? []).map((att) => (
            <a
              key={att.id}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[12px] text-white/55 transition-colors hover:bg-white/[0.07]"
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-white/30" />
              <span className="truncate">{att.name}</span>
              <span className="shrink-0 font-mono text-[10px] text-white/20">{(att.size / 1024).toFixed(0)}KB</span>
            </a>
          ))}

          {replies > 0 && (
            <button
              onClick={() => onReply(msg)}
              className={cn("flex items-center gap-1 px-1 text-[11px] text-white/35 hover:text-white/60", isOwn && "self-end")}
            >
              <Reply className="h-3 w-3" />
              {replies} repl{replies === 1 ? "y" : "ies"}
            </button>
          )}

          {Object.keys(grouped).length > 0 && (
            <div className="flex flex-wrap gap-1 px-0.5">
              {Object.entries(grouped).map(([emoji, { count, mine }]) => (
                <button
                  key={emoji}
                  onClick={() => onReact(msg.id, emoji)}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] transition-colors",
                    mine
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/10 bg-white/[0.04] text-white/50 hover:bg-white/8",
                  )}
                >
                  {emoji} <span className="text-[11px] font-medium">{count}</span>
                </button>
              ))}
            </div>
          )}

          {isOwn && readCount > 0 && (
            <div className="flex items-center gap-1 self-end px-1">
              <CheckCheck className="h-3 w-3 text-white/40" />
              <span className="text-[10px] text-white/25">Read by {readCount}</span>
            </div>
          )}
        </div>

        {/* hover action bar */}
        <div
          className={cn(
            "absolute top-0 flex items-center gap-0.5 rounded-xl border border-white/10 bg-[#111] px-1 py-0.5 opacity-0 shadow-lg transition-opacity group-hover:opacity-100",
            isOwn ? "left-5" : "right-5",
          )}
        >
          <div className="relative">
            <button onClick={() => setShowPicker(!showPicker)} className={iconBtn}>
              <Smile className="h-3.5 w-3.5" />
            </button>
            {showPicker && (
              <div className={cn("absolute bottom-9 z-50", isOwn ? "left-0" : "right-0")}>
                <Picker
                  data={data}
                  onEmojiSelect={(e: any) => {
                    onReact(msg.id, e.native);
                    setShowPicker(false);
                  }}
                  theme="dark"
                  previewPosition="none"
                  skinTonePosition="none"
                />
              </div>
            )}
          </div>
          <button onClick={() => onReply(msg)} className={iconBtn}>
            <Reply className="h-3.5 w-3.5" />
          </button>
          {isOwn && (
            <>
              <button onClick={() => onEdit(msg)} className={iconBtn}>
                <Edit3 className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => onDelete(msg.id)} className={iconBtn}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Conversation list item ──────────────────────────────────────── */
function ConvItem({ conv, active, currentUserId, onClick, onDelete }: {
  conv: any; active: boolean; currentUserId: string; onClick: () => void; onDelete: (id: string) => void;
}) {
  const others = conv.participants?.filter((p: any) => p.userId !== currentUserId) ?? [];
  const unread = conv.myParticipant?.unreadCount ?? 0;
  const name = conv.isGroup
    ? conv.subject
    : (others[0]?.user.name ?? others[0]?.user.email ?? conv.subject);

  return (
    <div className={cn("group relative mx-1 rounded-xl transition-colors", active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]")}>
      <button onClick={onClick} className="flex w-full items-start gap-3 rounded-xl px-3 py-3 pr-10 text-left">
        <div className="relative mt-0.5 shrink-0">
          {others.length > 0 ? (
            <UserAvatar name={others[0]?.user.name} email={others[0]?.user.email ?? ""} imageUrl={others[0]?.user.imageUrl} />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/30">
              <Users className="h-4 w-4" />
            </div>
          )}
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-0.5 text-[8.5px] font-bold text-black">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-1">
            <p className={cn("truncate text-[13px]", unread > 0 ? "font-semibold text-white" : "font-normal text-white/60")}>
              {name}
            </p>
            {conv.lastMessageAt && (
              <span className="shrink-0 text-[10px] text-white/25">{timeAgo(conv.lastMessageAt)}</span>
            )}
          </div>
          <p className={cn("mt-0.5 truncate text-[11.5px]", unread > 0 ? "text-white/50" : "text-white/25")}>
            {conv.lastMessagePreview ?? conv.subject}
          </p>
        </div>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(conv.id);
        }}
        title="Delete conversation"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/20 opacity-0 transition-colors hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ─── Compose modal ───────────────────────────────────────────────── */
function ComposeModal({ workspaceId, members, currentUserId, onCreated, onClose }: {
  workspaceId: string; members: any[]; currentUserId: string;
  onCreated: (c: any) => void; onClose: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const others = members.filter((m) => m.user.id !== currentUserId);
  const available = others.filter((m) => !selected.includes(m.user.id));
  const canSend = !creating && subject.trim() && message.trim() && selected.length > 0;
  const label = "text-[10.5px] font-medium uppercase tracking-wider text-white/25";

  const create = async () => {
    if (!canSend) return;
    setCreating(true);
    try {
      const res = await fetch("/api/workspace-chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId, subject, participantIds: selected,
          isGroup: selected.length > 1, initialMessage: message,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        onCreated(d.conversation);
        onClose();
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[520px] overflow-hidden rounded-3xl border border-white/10 shadow-2xl"
        style={{ backgroundColor: "#0d0d0d" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <h2 className="text-[14px] font-semibold text-white">New conversation</h2>
          <button onClick={onClose} className={iconBtn}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <div className="space-y-1">
            <label className={label}>Subject</label>
            <input autoFocus value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What's this about?" className={field} />
          </div>

          <div className="space-y-1.5">
            <label className={label}>To</label>
            <div className="flex min-h-[42px] flex-wrap gap-1.5 rounded-xl border border-white/8 bg-white/[0.04] p-2.5">
              {selected.map((id) => {
                const m = others.find((o) => o.user.id === id);
                return (
                  <span key={id} className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-2.5 py-1 text-[11.5px] text-white/70">
                    {m?.user.name ?? m?.user.email?.split("@")[0]}
                    <button onClick={() => setSelected((p) => p.filter((s) => s !== id))}>
                      <X className="h-3 w-3 text-white/30 hover:text-white/70" />
                    </button>
                  </span>
                );
              })}
              {available.length > 0 && (
                <div className="group/dd relative">
                  <button className="flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11.5px] text-white/30 transition-colors hover:border-white/20 hover:text-white/60">
                    <Plus className="h-3 w-3" /> Add person
                  </button>
                  <div className="absolute left-0 top-full z-20 hidden w-52 pt-1.5 group-hover/dd:block">
                    <div className="max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-[#111] py-1 shadow-2xl">
                      {available.map((m) => (
                        <button
                          key={m.user.id}
                          onClick={() => setSelected((p) => [...p, m.user.id])}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12px] text-white/55 transition-colors hover:bg-white/5 hover:text-white/80"
                        >
                          <UserAvatar name={m.user.name} email={m.user.email} imageUrl={m.user.imageUrl} size="xs" />
                          <span className="truncate">{m.user.name ?? m.user.email}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className={label}>Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Write your first message…"
              className={cn(field, "resize-none")}
            />
          </div>
        </div>

        <div className="flex gap-2 border-t border-white/[0.07] px-5 py-4">
          <button onClick={onClose} className="flex-1 rounded-xl border border-white/8 py-2.5 text-[12.5px] text-white/35 transition-colors hover:border-white/15 hover:text-white/60">
            Cancel
          </button>
          <button
            onClick={create}
            disabled={!canSend}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-[12.5px] font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-35"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {creating ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════ */
export default function WorkspaceChatPage() {
  const { user } = useUser();
  const { workspaceId } = useWorkspace();

  const [navFilter, setNavFilter] = useState("inbox");
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeConv, setActiveConv] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editMsg, setEditMsg] = useState<ChatMessage | null>(null);
  const [showPollForm, setShowPollForm] = useState(false);
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [codeContent, setCodeContent] = useState("");
  const [codeLang, setCodeLang] = useState("typescript");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", "", ""]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [myUserId, setMyUserId] = useState("");
  const [restoredOnce, setRestoredOnce] = useState(false);

  // sidebar state (collapsible, remembered across refreshes)
  const [navOpen, setNavOpen] = useState(true);
  const [listOpen, setListOpen] = useState(true);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const plusRef = useRef<HTMLDivElement>(null);

  const lastConvStorageKey = workspaceId ? `workspace-chat:last-conversation:${workspaceId}` : null;

  const { messages, setMessages, typingUsers, onlineUserIds, aiSummary, setAISummary, sendTyping } =
    usePusherChat(activeConvId, workspaceId, myUserId, (newConv) =>
      setConversations((prev) => upsertConversation(prev, newConv)),
    );

  /* load / save sidebar layout */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("workspace-chat:layout");
      if (raw) {
        const l = JSON.parse(raw);
        setNavOpen(l.navOpen ?? true);
        setListOpen(l.listOpen ?? true);
      }
    } catch {
      // ignore
    }
    setLayoutLoaded(true);
  }, []);
  useEffect(() => {
    if (!layoutLoaded) return;
    try {
      localStorage.setItem("workspace-chat:layout", JSON.stringify({ navOpen, listOpen }));
    } catch {
      // ignore
    }
  }, [navOpen, listOpen, layoutLoaded]);

  /* close "+" menu on outside click */
  useEffect(() => {
    if (!plusOpen) return;
    const h = (e: MouseEvent) => {
      if (plusRef.current && !plusRef.current.contains(e.target as Node)) setPlusOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [plusOpen]);

  /* fetch my DB user id + members */
  useEffect(() => {
    if (!workspaceId || !user) return;
    fetch(`/api/workspaces/${workspaceId}/members`)
      .then((r) => r.json())
      .then((d) => {
        const me = d.members?.find((m: any) => m.user.email === user.primaryEmailAddress?.emailAddress);
        if (me) setMyUserId(me.user.id);
        setMembers(d.members ?? []);
      })
      .catch(() => {});
  }, [workspaceId, user]);

  /* fetch conversations */
  const fetchConversations = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/workspace-chat/conversations?workspaceId=${workspaceId}&filter=${navFilter}`);
      const d = await res.json();
      setConversations(dedupeConversations(d.conversations ?? []));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, navFilter]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  /* open conversation */
  const openConversation = useCallback(
    async (convId: string) => {
      setActiveConvId(convId);
      setMessages([]);
      setThreadLoading(true);
      setReplyTo(null);
      setEditMsg(null);
      setAISummary(null);
      setSummaryOpen(false);
      try {
        const res = await fetch(`/api/workspace-chat/conversations/${convId}`);
        const d = await res.json();
        setActiveConv(d.conversation);
        setMessages(d.messages ?? []);
      } finally {
        setThreadLoading(false);
      }
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, myParticipant: { ...c.myParticipant, unreadCount: 0 } } : c)),
      );
    },
    [setMessages, setAISummary],
  );

  /* remember open conversation per workspace */
  useEffect(() => {
    if (!lastConvStorageKey || !activeConvId) return;
    try {
      localStorage.setItem(lastConvStorageKey, activeConvId);
    } catch {
      // ignore
    }
  }, [activeConvId, lastConvStorageKey]);

  /* restore last-open conversation once */
  useEffect(() => {
    if (restoredOnce || loading || !lastConvStorageKey || activeConvId) return;
    if (conversations.length === 0) return;
    try {
      const saved = localStorage.getItem(lastConvStorageKey);
      if (saved && conversations.some((c) => c.id === saved)) openConversation(saved);
    } catch {
      // ignore
    } finally {
      setRestoredOnce(true);
    }
  }, [restoredOnce, loading, lastConvStorageKey, conversations, activeConvId, openConversation]);

  /* auto scroll */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const resetTextarea = () => {
    if (inputRef.current) inputRef.current.style.height = "auto";
  };

  /* send message */
  const sendMessage = async () => {
    const content = showCodeForm ? codeContent.trim() : input.trim();
    if (!content || !activeConvId || sending) return;
    setSending(true);
    try {
      const body: any = { conversationId: activeConvId, content, type: showCodeForm ? "CODE" : "TEXT" };
      if (replyTo) body.parentId = replyTo.id;
      if (showCodeForm) body.metadata = { language: codeLang };

      const mentioned = Array.from(input.matchAll(/@(\w+)/g))
        .map((m) => members.find((mb) => mb.user.name?.toLowerCase() === m[1].toLowerCase())?.user.id)
        .filter(Boolean) as string[];
      if (mentioned.length > 0) body.mentionedUserIds = mentioned;

      if (editMsg) {
        await fetch(`/api/workspace-chat/messages/${editMsg.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: input.trim() }),
        });
        setEditMsg(null);
      } else {
        const res = await fetch("/api/workspace-chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          console.error("Failed to send message");
          return;
        }
        if (replyTo) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === replyTo.id
                ? { ...m, _count: { ...m._count, replies: (m._count?.replies ?? 0) + 1 } }
                : m,
            ),
          );
        }
      }
      setInput("");
      setCodeContent("");
      setShowCodeForm(false);
      setReplyTo(null);
      sendTyping(false);
      resetTextarea();
    } finally {
      setSending(false);
    }
  };

  /* send poll */
  const sendPoll = async () => {
    if (!pollQuestion.trim() || !activeConvId) return;
    const opts = pollOptions.filter((o) => o.trim());
    if (opts.length < 2) return;
    setSending(true);
    try {
      await fetch("/api/workspace-chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConvId,
          content: pollQuestion,
          type: "POLL",
          poll: { question: pollQuestion, options: opts },
        }),
      });
      setPollQuestion("");
      setPollOptions(["", "", ""]);
      setShowPollForm(false);
    } finally {
      setSending(false);
    }
  };

  const handleReact = async (msgId: string, emoji: string) => {
    await fetch(`/api/workspace-chat/messages/${msgId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
  };
  const handleDelete = async (msgId: string) => {
    if (!confirm("Delete this message?")) return;
    await fetch(`/api/workspace-chat/messages/${msgId}`, { method: "DELETE" });
  };

  /* delete an entire conversation */
  const handleDeleteConversation = async (convId: string) => {
    const conv = conversations.find((c) => c.id === convId) ?? activeConv;
    const isCreator = conv?.creatorId === myUserId;
    const ok = confirm(
      isCreator
        ? "Delete this conversation for everyone? This can't be undone."
        : "Remove this conversation from your inbox? Other participants will keep it.",
    );
    if (!ok) return;

    const res = await fetch(`/api/workspace-chat/conversations/${convId}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Couldn't delete this conversation. Please try again.");
      return;
    }
    setConversations((prev) => prev.filter((c) => c.id !== convId));
    if (activeConvId === convId) {
      setActiveConvId(null);
      setActiveConv(null);
      setMessages([]);
      setSummaryOpen(false);
      setAISummary(null);
    }
    if (lastConvStorageKey) {
      try {
        if (localStorage.getItem(lastConvStorageKey) === convId) localStorage.removeItem(lastConvStorageKey);
      } catch {
        // ignore
      }
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConvId) return;
    const input = e.target;
    try {
      const msgRes = await fetch("/api/workspace-chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeConvId, content: `📎 ${file.name}`, type: "FILE" }),
      });
      const msgData = await msgRes.json();
      const fd = new FormData();
      fd.append("file", file);
      fd.append("messageId", msgData.message.id);
      await fetch("/api/workspace-chat/upload", { method: "POST", body: fd });
    } finally {
      input.value = "";
    }
  };

  const requestSummary = async () => {
    if (!activeConvId) return;
    setSummaryLoading(true);
    setSummaryOpen(true);
    try {
      await fetch(`/api/workspace-chat/conversations/${activeConvId}/summary`, { method: "POST" });
    } finally {
      setSummaryLoading(false);
    }
  };
  const patchConv = async (convId: string, patch: object) => {
    await fetch(`/api/workspace-chat/conversations/${convId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    fetchConversations();
  };

  /* derived */
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    for (const msg of messages) {
      const label = formatDate(msg.createdAt);
      const last = groups[groups.length - 1];
      if (!last || last.date !== label) groups.push({ date: label, messages: [msg] });
      else last.messages.push(msg);
    }
    return groups;
  }, [messages]);

  const uniqueConversations = useMemo(() => dedupeConversations(conversations), [conversations]);
  const q = searchQuery.toLowerCase();
  const filtered = uniqueConversations.filter(
    (c) => c.subject?.toLowerCase().includes(q) || c.lastMessagePreview?.toLowerCase().includes(q),
  );
  const totalUnread = uniqueConversations.reduce((s, c) => s + (c.myParticipant?.unreadCount ?? 0), 0);
  const activeParticipants = activeConv?.participants ?? [];
  const others = activeParticipants.filter((p: any) => p.userId !== myUserId);
  const onlineMembers = members.filter((m) => onlineUserIds.has(m.user.id));
  const hasText = showCodeForm ? !!codeContent.trim() : !!input.trim();

  /* ── render ─────────────────────────────────────────────────────── */
  return (
    <div className="flex h-full overflow-hidden" style={{ backgroundColor: "#080808" }}>
      {/* ── LEFT NAV (collapses to icon rail) ─────────────────────── */}
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r border-white/[0.07] transition-[width] duration-200",
          navOpen ? "w-48" : "w-14",
        )}
        style={{ backgroundColor: "#0a0a0a" }}
      >
        <div className={cn("flex items-center p-3", navOpen ? "justify-between" : "justify-center")}>
          {navOpen && <span className="pl-1 text-[13px] font-semibold text-white/80">Messages</span>}
          <button
            onClick={() => setNavOpen(!navOpen)}
            title={navOpen ? "Collapse sidebar" : "Expand sidebar"}
            className={iconBtn}
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>

        <div className="px-3 pb-2">
          <button
            onClick={() => setShowCompose(true)}
            title="Compose"
            className={cn(
              "flex w-full items-center rounded-xl border border-white/12 bg-white/[0.05] py-2.5 text-[12.5px] font-medium text-white/70 transition-colors hover:bg-white/[0.09] hover:text-white",
              navOpen ? "gap-2 px-3" : "justify-center",
            )}
          >
            <Plus className="h-4 w-4 shrink-0" />
            {navOpen && "Compose"}
          </button>
        </div>

        <nav className="space-y-0.5 px-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setNavFilter(item.id)}
              title={item.label}
              className={cn(
                "relative flex w-full items-center rounded-xl py-2.5 text-[12.5px] transition-colors",
                navOpen ? "gap-2.5 px-3" : "justify-center",
                navFilter === item.id
                  ? "bg-white/[0.08] font-medium text-white"
                  : "text-white/35 hover:bg-white/[0.04] hover:text-white/65",
              )}
            >
              <item.Icon className="h-3.5 w-3.5 shrink-0" />
              {navOpen && item.label}
              {item.id === "inbox" && totalUnread > 0 &&
                (navOpen ? (
                  <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-black">
                    {totalUnread > 99 ? "99+" : totalUnread}
                  </span>
                ) : (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-white" />
                ))}
            </button>
          ))}
        </nav>

        <div className="mt-auto border-t border-white/[0.06] p-3">
          {navOpen && (
            <p className="mb-2 text-[10.5px] font-medium text-white/25">Online</p>
          )}
          <div className={cn("flex flex-wrap gap-1.5", !navOpen && "justify-center")}>
            {onlineMembers.slice(0, navOpen ? 8 : 3).map((m) => (
              <div key={m.user.id} className="relative" title={m.user.name ?? m.user.email}>
                <UserAvatar name={m.user.name} email={m.user.email} imageUrl={m.user.imageUrl} size="xs" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[#0a0a0a] bg-white" />
              </div>
            ))}
            {onlineMembers.length === 0 && navOpen && <p className="text-[11px] text-white/20">No one online</p>}
          </div>
        </div>
      </aside>

      {/* ── CONVERSATION LIST (collapses fully) ───────────────────── */}
      <aside
        className={cn(
          "shrink-0 overflow-hidden border-white/[0.07] transition-[width] duration-200",
          listOpen ? "w-72 border-r" : "w-0",
        )}
        style={{ backgroundColor: "#0c0c0c" }}
      >
        <div className="flex h-full w-72 flex-col">
          <div className="flex items-center gap-2 border-b border-white/[0.06] p-3">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-white/20" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search…"
                className="w-full bg-transparent text-[12px] text-white placeholder:text-white/20 focus:outline-none"
              />
            </div>
            <button onClick={() => setListOpen(false)} title="Close conversation list" className={iconBtn}>
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-0.5 overflow-y-auto py-1.5">
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-white/20" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
                <Inbox className="mb-2 h-6 w-6 text-white/10" />
                <p className="text-[12px] text-white/20">No conversations</p>
                {navFilter === "inbox" && (
                  <button onClick={() => setShowCompose(true)} className="mt-2 text-[11.5px] text-white/35 transition-colors hover:text-white/70">
                    Start a conversation
                  </button>
                )}
              </div>
            ) : (
              filtered.map((conv) => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  active={conv.id === activeConvId}
                  currentUserId={myUserId}
                  onClick={() => openConversation(conv.id)}
                  onDelete={handleDeleteConversation}
                />
              ))
            )}
          </div>
        </div>
      </aside>

      {/* ── THREAD PANEL ─────────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden" style={{ backgroundColor: "#080808" }}>
        {!activeConv ? (
          <div className="relative flex h-full flex-col items-center justify-center gap-5 text-center">
            {!listOpen && (
              <button onClick={() => setListOpen(true)} title="Open conversation list" className={cn(iconBtn, "absolute left-3 top-3")}>
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/8">
              <Inbox className="h-6 w-6 text-white/15" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-white/35">Select a conversation</p>
              <p className="mt-1 text-[12px] text-white/20">or compose a new one</p>
            </div>
            <button
              onClick={() => setShowCompose(true)}
              className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.05] px-5 py-2.5 text-[12.5px] font-medium text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              <Plus className="h-4 w-4" /> Compose
            </button>
          </div>
        ) : (
          <>
            {/* thread header */}
            <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-white/[0.07] px-4">
              <div className="flex min-w-0 items-center gap-2.5">
                {!listOpen && (
                  <button onClick={() => setListOpen(true)} title="Open conversation list" className={iconBtn}>
                    <PanelLeftOpen className="h-4 w-4" />
                  </button>
                )}
                {others.length > 0 && (
                  <UserAvatar name={others[0]?.user.name} email={others[0]?.user.email ?? ""} imageUrl={others[0]?.user.imageUrl} />
                )}
                <div className="min-w-0">
                  <h2 className="truncate text-[13.5px] font-semibold text-white">{activeConv.subject}</h2>
                  <p className="text-[10.5px] text-white/25">
                    {activeParticipants.length} participant{activeParticipants.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={requestSummary}
                  disabled={summaryLoading}
                  className="flex items-center gap-1.5 rounded-xl border border-white/8 px-2.5 py-1.5 text-[11.5px] text-white/35 transition-colors hover:border-white/15 hover:text-white/65 disabled:opacity-40"
                >
                  {summaryLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  AI Summary
                </button>
                <button
                  onClick={() => patchConv(activeConvId!, { isStarred: !activeConv.myParticipant?.isStarred })}
                  title="Star"
                  className={cn(
                    "rounded-xl border p-1.5 transition-colors",
                    activeConv.myParticipant?.isStarred
                      ? "border-white/20 bg-white/8 text-white"
                      : "border-white/8 text-white/25 hover:border-white/15 hover:text-white/60",
                  )}
                >
                  <Star className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => patchConv(activeConvId!, { status: "ARCHIVED" })}
                  title="Archive"
                  className="rounded-xl border border-white/8 p-1.5 text-white/25 transition-colors hover:border-white/15 hover:text-white/60"
                >
                  <Archive className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDeleteConversation(activeConvId!)}
                  title="Delete conversation"
                  className="rounded-xl border border-white/8 p-1.5 text-white/25 transition-colors hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* AI summary banner */}
            {summaryOpen && (
              <div className="border-b border-white/[0.07] bg-white/[0.03] px-5 py-3">
                <div className="mx-auto flex max-w-3xl items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40" />
                    <div className="min-w-0">
                      <p className="mb-1 text-[11px] font-medium text-white/30">AI Summary</p>
                      {summaryLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin text-white/30" />
                          <p className="text-[12.5px] text-white/30">Generating…</p>
                        </div>
                      ) : (
                        <p className="text-[12.5px] leading-relaxed text-white/60">{aiSummary}</p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setSummaryOpen(false)} className="shrink-0 text-white/20 transition-colors hover:text-white/50">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* messages */}
            <div className="flex-1 overflow-y-auto">
              {threadLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-white/20" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-[12px] text-white/20">No messages yet</p>
                </div>
              ) : (
                <div className="pb-2 pt-4">
                  {groupedMessages.map((group) => (
                    <div key={group.date}>
                      <DateSeparator label={group.date} />
                      {group.messages.map((msg, i) => {
                        const prev = group.messages[i - 1];
                        const showAvatar =
                          !prev ||
                          prev.senderId !== msg.senderId ||
                          new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > 60000;
                        return (
                          <MessageBubble
                            key={msg.id}
                            msg={msg}
                            isOwn={msg.senderId === myUserId}
                            showAvatar={showAvatar}
                            currentUserId={myUserId}
                            onReact={handleReact}
                            onReply={(m) => {
                              setReplyTo(m);
                              setEditMsg(null);
                              setInput("");
                              setTimeout(() => inputRef.current?.focus(), 50);
                            }}
                            onEdit={(m) => {
                              setEditMsg(m);
                              setReplyTo(null);
                              setInput(m.content);
                              setTimeout(() => inputRef.current?.focus(), 50);
                            }}
                            onDelete={handleDelete}
                          />
                        );
                      })}
                    </div>
                  ))}

                  {typingUsers.length > 0 && (
                    <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-5 py-2">
                      <div className="flex gap-0.5">
                        {[0, 150, 300].map((d) => (
                          <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/25" style={{ animationDelay: `${d}ms` }} />
                        ))}
                      </div>
                      <p className="text-[11.5px] text-white/25">
                        {typingUsers.map((u) => u.userName).join(", ")}
                        {typingUsers.length === 1 ? " is" : " are"} typing…
                      </p>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* ── Claude-style input ────────────────────────────── */}
            <div className="shrink-0 px-4 pb-4 pt-2">
              <div className="mx-auto max-w-3xl">
                <div className="rounded-3xl border border-white/10 bg-[#141414] shadow-[0_2px_24px_rgba(0,0,0,0.5)] transition-colors focus-within:border-white/20">
                  {/* reply / edit context */}
                  {(replyTo || editMsg) && (
                    <div className="mx-3 mt-3 flex items-start gap-2 rounded-2xl bg-white/[0.04] px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center gap-1.5">
                          {replyTo ? <Reply className="h-3 w-3 text-white/30" /> : <Edit3 className="h-3 w-3 text-white/30" />}
                          <span className="text-[11px] font-medium text-white/45">
                            {replyTo
                              ? `Replying to ${replyTo.sender.name ?? replyTo.sender.email.split("@")[0]}`
                              : "Editing message"}
                          </span>
                        </div>
                        <p className="truncate pl-[18px] text-[12px] text-white/25">
                          {(replyTo?.content ?? editMsg?.content ?? "").slice(0, 80)}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setReplyTo(null);
                          setEditMsg(null);
                          setInput("");
                          resetTextarea();
                        }}
                        className="mt-0.5 shrink-0 rounded-lg p-0.5 text-white/25 transition-colors hover:text-white/60"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {/* poll form */}
                  {showPollForm && (
                    <div className="mx-3 mt-3 space-y-2 rounded-2xl bg-white/[0.04] p-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BarChart2 className="h-3.5 w-3.5 text-white/40" />
                          <span className="text-[12px] font-medium text-white/60">Create poll</span>
                        </div>
                        <button onClick={() => setShowPollForm(false)} className="text-white/25 hover:text-white/55">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <input
                        value={pollQuestion}
                        onChange={(e) => setPollQuestion(e.target.value)}
                        placeholder="Poll question…"
                        className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-[12.5px] text-white placeholder:text-white/20 focus:border-white/15 focus:outline-none"
                      />
                      {pollOptions.map((opt, i) => (
                        <input
                          key={i}
                          value={opt}
                          onChange={(e) => {
                            const next = [...pollOptions];
                            next[i] = e.target.value;
                            if (i === pollOptions.length - 1 && e.target.value && pollOptions.length < 6) next.push("");
                            setPollOptions(next);
                          }}
                          placeholder={`Option ${i + 1}…`}
                          className="w-full rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-[12px] text-white placeholder:text-white/20 focus:border-white/15 focus:outline-none"
                        />
                      ))}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={sendPoll}
                          disabled={sending || !pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2}
                          className="rounded-xl bg-white px-4 py-1.5 text-[11.5px] font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-40"
                        >
                          Send poll
                        </button>
                        <button onClick={() => setShowPollForm(false)} className="rounded-xl border border-white/8 px-3 py-1.5 text-[11.5px] text-white/35 transition-colors hover:text-white/60">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* code form */}
                  {showCodeForm && (
                    <div className="mx-3 mt-3 overflow-hidden rounded-2xl bg-black/50">
                      <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
                        <Code2 className="h-3.5 w-3.5 text-white/30" />
                        <select
                          value={codeLang}
                          onChange={(e) => setCodeLang(e.target.value)}
                          className="bg-transparent text-[11.5px] text-white/40 focus:outline-none"
                        >
                          {["typescript", "javascript", "python", "go", "java", "rust", "sql", "bash", "json"].map((l) => (
                            <option key={l} value={l} className="bg-[#111]">{l}</option>
                          ))}
                        </select>
                        <button onClick={() => setShowCodeForm(false)} className="ml-auto text-white/20 hover:text-white/55">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <textarea
                        autoFocus
                        value={codeContent}
                        onChange={(e) => setCodeContent(e.target.value)}
                        placeholder="Paste your code here…"
                        rows={6}
                        className="w-full resize-none bg-transparent px-4 py-3 font-mono text-[12px] text-white/70 placeholder:text-white/15 focus:outline-none"
                      />
                    </div>
                  )}

                  {/* text area */}
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      sendTyping(e.target.value.length > 0);
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder={
                      showCodeForm
                        ? "Add a note (optional)…"
                        : replyTo
                          ? "Write a reply…"
                          : editMsg
                            ? "Edit your message…"
                            : "Write a message…"
                    }
                    rows={1}
                    className="block w-full resize-none bg-transparent px-5 pb-1 pt-4 text-[14px] leading-relaxed text-white placeholder:text-white/25 focus:outline-none"
                    style={{ minHeight: "52px", maxHeight: "200px" }}
                  />

                  {/* toolbar row */}
                  <div className="flex items-center justify-between px-3 pb-3 pt-1">
                    <div className="flex items-center gap-1">
                      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} />
                      <div className="relative" ref={plusRef}>
                        <button
                          onClick={() => setPlusOpen(!plusOpen)}
                          title="Add"
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/50 transition-all hover:bg-white/[0.06] hover:text-white",
                            plusOpen && "rotate-45 bg-white/[0.06] text-white",
                          )}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        {plusOpen && (
                          <div className="absolute bottom-11 left-0 z-30 w-48 overflow-hidden rounded-2xl border border-white/10 bg-[#111] p-1 shadow-2xl">
                            {[
                              { label: "Attach file", Icon: Paperclip, run: () => fileInputRef.current?.click() },
                              {
                                label: "Create poll", Icon: BarChart2,
                                run: () => { setShowPollForm(true); setShowCodeForm(false); },
                              },
                              {
                                label: "Code block", Icon: Code2,
                                run: () => { setShowCodeForm(true); setShowPollForm(false); },
                              },
                            ].map(({ label, Icon, run }) => (
                              <button
                                key={label}
                                onClick={() => { run(); setPlusOpen(false); }}
                                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[12.5px] text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
                              >
                                <Icon className="h-4 w-4 text-white/35" />
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="hidden text-[11px] text-white/20 sm:block">↵ send · ⇧↵ new line</span>
                      <button
                        onClick={sendMessage}
                        disabled={!hasText || sending}
                        title="Send"
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full transition-all",
                          hasText && !sending ? "bg-white text-black hover:bg-white/90" : "bg-white/10 text-white/25",
                        )}
                      >
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {showCompose && (
        <ComposeModal
          workspaceId={workspaceId ?? ""}
          members={members}
          currentUserId={myUserId}
          onCreated={(conv) => {
            setConversations((prev) => upsertConversation(prev, conv));
            openConversation(conv.id);
          }}
          onClose={() => setShowCompose(false)}
        />
      )}
    </div>
  );
}
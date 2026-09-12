/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { useUser } from "@clerk/nextjs";
import {
  Plus, X, Loader2, MessageSquare, Paperclip,
  GripVertical, MoreHorizontal, Pencil, Trash2,
  ChevronDown, Check, RefreshCw, Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────────────────────── */
interface Member {
  id: string; name: string | null; email: string; imageUrl: string | null;
}

interface KanbanCard {
  id: string; ticketId: string; title: string;
  description: string | null; column: string; position: number;
  label: string | null; labelColor: string | null;
  assignee: Member | null; creator: Member;
  _count: { comments: number; attachments: number };
}

interface Comment {
  id: string; content: string; createdAt: string;
  user: Member;
}

interface CardDetail extends KanbanCard {
  comments: Comment[];
  attachments: { id: string; name: string; url: string }[];
}

interface Board {
  id: string; name: string; updatedAt: string;
  cards: KanbanCard[];
}

/* ─── Constants ──────────────────────────────────────────────────────── */
const COLUMNS = [
  { id: "todo",       label: "To Do",        accent: "#6B7280" },
  { id: "inprogress", label: "In Progress",  accent: "#3B82F6" },
  { id: "testing",    label: "Testing",       accent: "#F59E0B" },
  { id: "done",       label: "Done",          accent: "#10B981" },
];

const LABELS = [
  { name: "Platform",  color: "#6366F1" },
  { name: "Billing",   color: "#F59E0B" },
  { name: "API",       color: "#3B82F6" },
  { name: "Identity",  color: "#8B5CF6" },
  { name: "Growth",    color: "#10B981" },
  { name: "Design",    color: "#EC4899" },
];

/* ─── Global scroll / scrollbar styling ─────────────────────────────────
   Hides the visible scrollbar track everywhere it's applied while keeping
   the element fully scrollable, and makes wheel / drag scrolling glide
   instead of jumping. Drop this once at the root of the board. */
function ScrollPolish() {
  return (
    <style jsx global>{`
      .no-scrollbar {
        scrollbar-width: none;       /* Firefox */
        -ms-overflow-style: none;    /* old Edge / IE */
        scroll-behavior: smooth;
      }
      .no-scrollbar::-webkit-scrollbar {
        display: none;               /* Chrome, Safari, new Edge */
      }
      .kanban-fade-mask {
        -webkit-mask-image: linear-gradient(to bottom, black calc(100% - 24px), transparent 100%);
        mask-image: linear-gradient(to bottom, black calc(100% - 24px), transparent 100%);
      }
    `}</style>
  );
}

/* ─── Avatar stack ───────────────────────────────────────────────────── */
function MemberAvatar({ member, size = "sm" }: { member: Member; size?: "sm" | "xs" }) {
  const initials = (member.name ?? member.email)
    .split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
  return (
    <Avatar className={cn(size === "xs" ? "h-5 w-5" : "h-6 w-6", "ring-1 ring-white/10")}>
      <AvatarImage src={member.imageUrl ?? ""} />
      <AvatarFallback className="text-[9px] font-medium" style={{ backgroundColor: "#2D2D35" }}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

/* ─── Label badge ────────────────────────────────────────────────────── */
function LabelBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium ring-1"
      style={{ backgroundColor: color + "1A", color, borderColor: color + "33", ["--tw-ring-color" as any]: color + "26" }}
    >
      {name}
    </span>
  );
}

/* ─── Card detail modal ──────────────────────────────────────────────── */
function CardModal({
  cardId, members, onClose, onUpdate, onDelete,
}: {
  cardId: string;
  members: Member[];
  onClose: () => void;
  onUpdate: (card: KanbanCard) => void;
  onDelete: (cardId: string) => void;
}) {
  const { user } = useUser();
  const [card,         setCard        ] = useState<CardDetail | null>(null);
  const [loading,      setLoading     ] = useState(true);
  const [editTitle,    setEditTitle   ] = useState(false);
  const [titleVal,     setTitleVal    ] = useState("");
  const [editDesc,     setEditDesc    ] = useState(false);
  const [descVal,      setDescVal     ] = useState("");
  const [comment,      setComment     ] = useState("");
  const [posting,      setPosting     ] = useState(false);
  const [showAssignee, setShowAssignee] = useState(false);
  const [showLabel,    setShowLabel   ] = useState(false);
  const [deleting,     setDeleting    ] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const fetchCard = useCallback(async () => {
    const res  = await fetch(`/api/kanban/cards/${cardId}`);
    const data = await res.json();
    setCard(data.card);
    setTitleVal(data.card.title);
    setDescVal(data.card.description ?? "");
    setLoading(false);
  }, [cardId]);

  useEffect(() => { fetchCard(); }, [fetchCard]);

  const patch = async (body: Partial<KanbanCard>) => {
    const res  = await fetch(`/api/kanban/cards/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setCard(prev => prev ? { ...prev, ...data.card } : prev);
    onUpdate(data.card);
  };

  const handlePostComment = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    const res  = await fetch(`/api/kanban/cards/${cardId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: comment }),
    });
    const data = await res.json();
    setCard(prev => prev ? { ...prev, comments: [...prev.comments, data.comment] } : prev);
    setComment("");
    setPosting(false);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this card?")) return;
    setDeleting(true);
    await fetch(`/api/kanban/cards/${cardId}`, { method: "DELETE" });
    onDelete(cardId);
    onClose();
  };

  if (loading || !card) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <Loader2 className="h-6 w-6 animate-spin text-white/30" />
      </div>
    );
  }

  const colInfo = COLUMNS.find(c => c.id === card.column);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div
        className="relative flex w-full max-w-2xl max-h-[85vh] overflow-hidden flex-col rounded-2xl border border-white/10 shadow-[0_24px_70px_-12px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.04] animate-in fade-in zoom-in-95 duration-150"
        style={{ backgroundColor: "#111116" }}
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start justify-between border-b border-white/[0.06] px-6 py-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-mono text-white/25">{card.ticketId}</span>
              {card.label && <LabelBadge name={card.label} color={card.labelColor ?? "#6366F1"} />}
              {colInfo && (
                <span
                  className="rounded-md px-2 py-0.5 text-[10px] font-medium"
                  style={{ backgroundColor: colInfo.accent + "1A", color: colInfo.accent }}
                >
                  {colInfo.label}
                </span>
              )}
            </div>
            {editTitle ? (
              <input
                autoFocus
                value={titleVal}
                onChange={e => setTitleVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    patch({ title: titleVal });
                    setEditTitle(false);
                  }
                  if (e.key === "Escape") setEditTitle(false);
                }}
                className="w-full bg-transparent text-base font-semibold text-white focus:outline-none border-b border-primary/40 pb-0.5"
              />
            ) : (
              <h2
                className="text-base font-semibold text-white cursor-pointer transition-colors hover:text-white/80"
                onClick={() => setEditTitle(true)}
              >
                {card.title}
              </h2>
            )}
          </div>
          <div className="ml-4 flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg p-1.5 text-white/15 transition-colors hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-white/20 transition-colors hover:bg-white/5 hover:text-white/60"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* body */}
        <div className="flex flex-1 overflow-hidden">
          {/* left — main content */}
          <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-4 space-y-5">
            {/* description */}
            <div>
              <p className="mb-1.5 text-[10px] font-medium text-white/25 uppercase tracking-wider">Description</p>
              {editDesc ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    value={descVal}
                    onChange={e => setDescVal(e.target.value)}
                    rows={4}
                    className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/80 placeholder:text-white/15 focus:border-primary/40 focus:outline-none transition-colors"
                    placeholder="Add a description…"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { patch({ description: descVal }); setEditDesc(false); }}
                      className="rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/25"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditDesc(false)}
                      className="rounded-lg px-3 py-1.5 text-xs text-white/30 transition-colors hover:text-white/60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setEditDesc(true)}
                  className="min-h-[60px] cursor-pointer rounded-xl border border-dashed border-white/8 px-3 py-2.5 text-sm text-white/40 transition-colors hover:border-white/15 hover:text-white/60"
                >
                  {card.description ?? "Click to add a description…"}
                </div>
              )}
            </div>

            {/* comments */}
            <div>
              <p className="mb-2.5 text-[10px] font-medium text-white/25 uppercase tracking-wider">
                Comments {card.comments.length > 0 && `(${card.comments.length})`}
              </p>
              <div className="space-y-3">
                {card.comments.map(c => (
                  <div key={c.id} className="flex gap-2.5">
                    <MemberAvatar member={c.user} size="xs" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-medium text-white/60">
                          {c.user.name ?? c.user.email}
                        </span>
                        <span className="text-[10px] text-white/20">
                          {new Date(c.createdAt).toLocaleDateString("en-US", {
                            month: "short", day: "numeric",
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-white/50 leading-relaxed">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* add comment */}
              <div className="mt-3 flex gap-2.5">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/8 text-[9px] text-white/40">
                  {user?.firstName?.[0] ?? "?"}
                </div>
                <div className="flex-1 space-y-2">
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePostComment();
                    }}
                    placeholder="Add a comment… (⌘↵ to submit)"
                    rows={2}
                    className="w-full resize-none rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-white/70 placeholder:text-white/15 focus:border-white/15 focus:outline-none transition-colors"
                  />
                  <button
                    onClick={handlePostComment}
                    disabled={posting || !comment.trim()}
                    className="rounded-lg bg-primary/15 px-3 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/25 disabled:opacity-40"
                  >
                    {posting ? "Posting…" : "Post comment"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* right — meta sidebar */}
          <div className="w-44 shrink-0 border-l border-white/[0.06] px-4 py-4 space-y-4 overflow-y-auto no-scrollbar">
            {/* assignee */}
            <div>
              <p className="mb-1.5 text-[9px] font-medium uppercase tracking-wider text-white/20">Assignee</p>
              <div className="relative">
                <button
                  onClick={() => setShowAssignee(!showAssignee)}
                  className="flex w-full items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5 text-[11px] text-white/50 transition-colors hover:border-white/15"
                >
                  {card.assignee ? (
                    <>
                      <MemberAvatar member={card.assignee} size="xs" />
                      <span className="truncate text-white/60">
                        {card.assignee.name ?? card.assignee.email}
                      </span>
                    </>
                  ) : (
                    <>
                      <Users className="h-3.5 w-3.5" />
                      <span>Unassigned</span>
                    </>
                  )}
                </button>
                {showAssignee && (
                  <div
                    className="absolute left-0 top-full z-10 mt-1 w-full overflow-hidden rounded-xl border border-white/10 py-1 shadow-xl no-scrollbar"
                    style={{ backgroundColor: "#1a1a20" }}
                  >
                    <button
                      onClick={() => { patch({ assigneeId: null }); setShowAssignee(false); }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[11px] text-white/30 transition-colors hover:bg-white/5"
                    >
                      <X className="h-3 w-3" /> Unassign
                    </button>
                    {members.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { patch({ assigneeId: m.id }); setShowAssignee(false); }}
                        className={cn(
                          "flex w-full items-center gap-2 px-2.5 py-1.5 text-[11px] transition-colors hover:bg-white/5",
                          card.assignee?.id === m.id ? "text-primary" : "text-white/50"
                        )}
                      >
                        <MemberAvatar member={m} size="xs" />
                        <span className="truncate">{m.name ?? m.email}</span>
                        {card.assignee?.id === m.id && <Check className="ml-auto h-3 w-3 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* label */}
            <div>
              <p className="mb-1.5 text-[9px] font-medium uppercase tracking-wider text-white/20">Label</p>
              <div className="relative">
                <button
                  onClick={() => setShowLabel(!showLabel)}
                  className="flex w-full items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5 text-[11px] transition-colors hover:border-white/15"
                >
                  {card.label
                    ? <LabelBadge name={card.label} color={card.labelColor ?? "#6366F1"} />
                    : <span className="text-white/30">No label</span>}
                </button>
                {showLabel && (
                  <div
                    className="absolute left-0 top-full z-10 mt-1 w-full overflow-hidden rounded-xl border border-white/10 py-1 shadow-xl no-scrollbar"
                    style={{ backgroundColor: "#1a1a20" }}
                  >
                    <button
                      onClick={() => { patch({ label: null, labelColor: null }); setShowLabel(false); }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[11px] text-white/30 transition-colors hover:bg-white/5"
                    >
                      <X className="h-3 w-3" /> Remove
                    </button>
                    {LABELS.map(l => (
                      <button
                        key={l.name}
                        onClick={() => { patch({ label: l.name, labelColor: l.color }); setShowLabel(false); }}
                        className="flex w-full items-center gap-2 px-2.5 py-1.5 transition-colors hover:bg-white/5"
                      >
                        <LabelBadge name={l.name} color={l.color} />
                        {card.label === l.name && <Check className="ml-auto h-3 w-3 text-primary shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* move to column */}
            <div>
              <p className="mb-1.5 text-[9px] font-medium uppercase tracking-wider text-white/20">Move to</p>
              <div className="space-y-1">
                {COLUMNS.filter(c => c.id !== card.column).map(col => (
                  <button
                    key={col.id}
                    onClick={() => { patch({ column: col.id }); }}
                    className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-white/35 transition-colors hover:bg-white/5 hover:text-white/60"
                  >
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: col.accent }} />
                    {col.label}
                  </button>
                ))}
              </div>
            </div>

            {/* stats */}
            <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-white/25">
                <MessageSquare className="h-3 w-3" />
                {card.comments.length} comment{card.comments.length !== 1 ? "s" : ""}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-white/25">
                <Paperclip className="h-3 w-3" />
                {card.attachments.length} attachment{card.attachments.length !== 1 ? "s" : ""}
              </div>
              <div className="text-[10px] text-white/15 mt-2">
                Created by {card.creator.name ?? card.creator.email}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Kanban card ────────────────────────────────────────────────────── */
function Card({
  card, onClick, onDragStart,
}: {
  card: KanbanCard;
  onClick: () => void;
  onDragStart: (e: React.DragEvent, card: KanbanCard) => void;
}) {
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, card)}
      onClick={onClick}
      className="group cursor-pointer rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5 transition-all duration-150 hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-white/[0.045] hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] active:translate-y-0 active:scale-[0.98] active:opacity-70"
    >
      {/* ticket id + drag handle */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] text-white/20">{card.ticketId}</span>
        <GripVertical className="h-3.5 w-3.5 text-white/0 transition-colors group-hover:text-white/15" />
      </div>

      {/* title */}
      <p className="text-[13px] font-medium text-white/80 leading-snug mb-3">
        {card.title}
      </p>

      {/* label */}
      {card.label && (
        <div className="mb-2.5">
          <LabelBadge name={card.label} color={card.labelColor ?? "#6366F1"} />
        </div>
      )}

      {/* footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-[10px] text-white/20">
          {card._count.comments > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {card._count.comments}
            </span>
          )}
          {card._count.attachments > 0 && (
            <span className="flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              {card._count.attachments}
            </span>
          )}
        </div>

        {card.assignee && (
          <MemberAvatar member={card.assignee} size="xs" />
        )}
      </div>
    </div>
  );
}

/* ─── Add card form ──────────────────────────────────────────────────── */
function AddCardForm({
  column, boardId, workspaceId, onAdd, onCancel,
}: {
  column: string; boardId: string; workspaceId: string;
  onAdd: (card: KanbanCard) => void; onCancel: () => void;
}) {
  const [title,   setTitle  ] = useState("");
  const [saving,  setSaving ] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const res  = await fetch("/api/kanban/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, title: title.trim(), column }),
    });
    const data = await res.json();
    if (res.ok) { onAdd(data.card); setTitle(""); }
    setSaving(false);
  };

  return (
    <div
      className="rounded-xl border border-primary/25 p-3 transition-shadow focus-within:shadow-[0_0_0_3px_rgba(124,58,237,0.12)]"
      style={{ backgroundColor: "rgba(124,58,237,0.05)" }}
    >
      <textarea
        autoFocus
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); }
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Card title…"
        rows={2}
        className="w-full resize-none bg-transparent text-sm text-white/80 placeholder:text-white/20 focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Add card
        </button>
        <button onClick={onCancel} className="rounded-lg px-2 py-1.5 text-[11px] text-white/25 transition-colors hover:text-white/60">
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─── Column ─────────────────────────────────────────────────────────── */
function KanbanColumn({
  col, cards, boardId, workspaceId, members,
  onCardClick, onCardAdd, onCardUpdate, onCardDelete,
  onDragStart, onDragOver, onDrop,
}: {
  col:            typeof COLUMNS[0];
  cards:          KanbanCard[];
  boardId:        string;
  workspaceId:    string;
  members:        Member[];
  onCardClick:    (id: string) => void;
  onCardAdd:      (card: KanbanCard) => void;
  onCardUpdate:   (card: KanbanCard) => void;
  onCardDelete:   (id: string) => void;
  onDragStart:    (e: React.DragEvent, card: KanbanCard) => void;
  onDragOver:     (e: React.DragEvent) => void;
  onDrop:         (e: React.DragEvent, colId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);

  return (
    <div
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-2xl border bg-white/[0.015] px-3 pt-3 pb-1 transition-colors duration-150",
        isDropTarget ? "border-white/20 bg-white/[0.03]" : "border-white/[0.06]"
      )}
      onDragOver={e => { onDragOver(e); setIsDropTarget(true); }}
      onDragLeave={() => setIsDropTarget(false)}
      onDrop={e => { setIsDropTarget(false); onDrop(e, col.id); }}
    >
      {/* column header */}
      <div className="mb-3 flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: col.accent, boxShadow: `0 0 0 3px ${col.accent}22` }} />
          <h3 className="text-sm font-semibold text-white/70">{col.label}</h3>
          <span
            className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-white/30"
            style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
          >
            {cards.length}
          </span>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="rounded-lg p-1 text-white/15 transition-colors hover:bg-white/5 hover:text-white/50"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* drop zone — scrollbar hidden, smooth scrolling, soft fade at the bottom edge */}
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto no-scrollbar kanban-fade-mask pb-4">
        {cards.map(card => (
          <Card
            key={card.id}
            card={card}
            onClick={() => onCardClick(card.id)}
            onDragStart={onDragStart}
          />
        ))}

        {adding && (
          <AddCardForm
            column={col.id}
            boardId={boardId}
            workspaceId={workspaceId}
            onAdd={card => { onCardAdd(card); setAdding(false); }}
            onCancel={() => setAdding(false)}
          />
        )}

        {/* empty drop target */}
        {cards.length === 0 && !adding && (
          <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-white/8 text-[11px] text-white/15">
            Drop cards here
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════ */
export default function KanbanPage() {
  const { workspaceId } = useWorkspace();
  const [board,         setBoard        ] = useState<Board | null>(null);
  const [cards,         setCards        ] = useState<KanbanCard[]>([]);
  const [members,       setMembers      ] = useState<Member[]>([]);
  const [loading,       setLoading      ] = useState(true);
  const [activeCard,    setActiveCard   ] = useState<string | null>(null);
  const [dragging,      setDragging     ] = useState<KanbanCard | null>(null);
  const [lastSynced,    setLastSynced   ] = useState<string | null>(null);
  const [editingTitle,  setEditingTitle ] = useState(false);
  const [boardTitle,    setBoardTitle   ] = useState("");

  const fetchBoard = useCallback(async (silent = false) => {
    if (!workspaceId) return;
    if (!silent) setLoading(true);
    try {
      const res  = await fetch(`/api/kanban/board?workspaceId=${workspaceId}`);
      const data = await res.json();
      setBoard(data.board);
      setCards(data.board.cards);
      setMembers(data.members);
      setBoardTitle(data.board.name);
      setLastSynced(data.board.updatedAt);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { fetchBoard(false); }, [fetchBoard]);

  // real-time polling — sync with other workspace members
  useEffect(() => {
    if (!workspaceId || !lastSynced) return;
    const interval = setInterval(async () => {
      try {
        const res  = await fetch(`/api/kanban/board?workspaceId=${workspaceId}`);
        const data = await res.json();
        if (data.board.updatedAt !== lastSynced) {
          setCards(data.board.cards);
          setLastSynced(data.board.updatedAt);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [workspaceId, lastSynced]);

  /* drag and drop */
  const handleDragStart = (e: React.DragEvent, card: KanbanCard) => {
    setDragging(card);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (!dragging || !board) return;

    const colCards  = cards.filter(c => c.column === colId && c.id !== dragging.id);
    const newPos    = colCards.length;

    // optimistic update
    setCards(prev => prev.map(c =>
      c.id === dragging.id ? { ...c, column: colId, position: newPos } : c
    ));

    await fetch("/api/kanban/cards/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardId:      dragging.id,
        newColumn:   colId,
        newPosition: newPos,
        boardId:     board.id,
      }),
    });

    setDragging(null);
    setLastSynced(new Date().toISOString());
  };

  const handleCardAdd = (card: KanbanCard) => {
    setCards(prev => [...prev, card]);
    setLastSynced(new Date().toISOString());
  };

  const handleCardUpdate = (updated: KanbanCard) => {
    setCards(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
    setLastSynced(new Date().toISOString());
  };

  const handleCardDelete = (cardId: string) => {
    setCards(prev => prev.filter(c => c.id !== cardId));
    setLastSynced(new Date().toISOString());
  };

  const handleBoardRename = async () => {
    if (!boardTitle.trim() || !workspaceId) return;
    setEditingTitle(false);
    await fetch("/api/kanban/board", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, name: boardTitle.trim() }),
    });
  };

  const openCount = cards.filter(c => c.column !== "done").length;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-white/30">Loading board…</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{
        backgroundImage:
          "radial-gradient(1200px 500px at 15% -10%, rgba(124,58,237,0.06), transparent 60%), radial-gradient(900px 400px at 90% 0%, rgba(59,130,246,0.05), transparent 55%)",
      }}
    >
      <ScrollPolish />

      {/* header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-8 py-4 shrink-0 backdrop-blur-sm">
        <div>
          {editingTitle ? (
            <input
              autoFocus
              value={boardTitle}
              onChange={e => setBoardTitle(e.target.value)}
              onBlur={handleBoardRename}
              onKeyDown={e => { if (e.key === "Enter") handleBoardRename(); if (e.key === "Escape") setEditingTitle(false); }}
              className="bg-transparent text-xl font-bold text-white focus:outline-none border-b border-primary/40"
            />
          ) : (
            <h1
              className="text-xl font-bold tracking-tight text-white cursor-pointer transition-colors hover:text-white/80"
              onClick={() => setEditingTitle(true)}
            >
              {boardTitle}
            </h1>
          )}
          <p className="mt-0.5 text-sm text-white/25">
            {openCount} open item{openCount !== 1 ? "s" : ""} · Drag a card to move it between columns
          </p>
        </div>

        {/* member avatars */}
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            {members.slice(0, 5).map((m, i) => (
              <div key={m.id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: members.length - i }}>
                <MemberAvatar member={m} />
              </div>
            ))}
            {members.length > 5 && (
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-[9px] text-white/30"
                style={{ marginLeft: -8, backgroundColor: "#1a1a20" }}
              >
                +{members.length - 5}
              </div>
            )}
          </div>

          <button
            onClick={() => fetchBoard(true)}
            className="rounded-lg p-1.5 text-white/20 transition-colors hover:bg-white/5 hover:text-white/60"
            title="Refresh board"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden no-scrollbar">
        <div className="flex h-full gap-5 px-8 py-6">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              col={col}
              cards={cards.filter(c => c.column === col.id).sort((a, b) => a.position - b.position)}
              boardId={board?.id ?? ""}
              workspaceId={workspaceId ?? ""}
              members={members}
              onCardClick={id => setActiveCard(id)}
              onCardAdd={handleCardAdd}
              onCardUpdate={handleCardUpdate}
              onCardDelete={handleCardDelete}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          ))}
        </div>
      </div>

      {/* card detail modal */}
      {activeCard && board && (
        <CardModal
          cardId={activeCard}
          members={members}
          onClose={() => setActiveCard(null)}
          onUpdate={handleCardUpdate}
          onDelete={handleCardDelete}
        />
      )}
    </div>
  );
}
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import {
  Shield, ShieldCheck, Sparkles, ArrowUp, Loader2,
  CheckCircle2, AlertTriangle, Database, Copy, Check,
  Plus, PanelRightClose, PanelRightOpen, Zap, Activity,
  Search, TrendingUp, ListChecks, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownMessage } from "../markdown-message";
import { useAuditAlerts } from "@/hooks/use-audit-alerts";

/* ── types ──────────────────────────────────────────────────────────── */
interface Memory {
  summary:         string;
  memory_type:     string;
  control_id:      string;
  severity:        string;
  status:          string;
  created_at:      string;
  relevance_score: number;
}

interface ControlStatus {
  controlId:   string;
  title:       string;
  status:      "PASSING" | "FAILING" | "NEEDS_REVIEW" | "NOT_TESTED";
  liveIssues:  number;
  auditIssues: number;
}

interface Message {
  id:                string;
  role:              "user" | "agent";
  content:           string;
  interactionNumber: number;
  memoriesUsed?:     Memory[];
  isError?:          boolean;
}

/* ── constants ───────────────────────────────────────────────────────── */
const STATUS_STYLE = {
  PASSING:      { dot: "bg-emerald-400", text: "text-emerald-400", ring: "#34d399", label: "Passing"      },
  FAILING:      { dot: "bg-red-400",     text: "text-red-400",     ring: "#f87171", label: "Failing"      },
  NEEDS_REVIEW: { dot: "bg-amber-400",   text: "text-amber-400",   ring: "#fbbf24", label: "Needs review" },
  NOT_TESTED:   { dot: "bg-white/25",    text: "text-white/35",    ring: "#ffffff40", label: "Not tested" },
} as const;

const STARTERS = [
  { icon: ShieldCheck,   title: "Renewal readiness",    prompt: "Are we ready for our SOC 2 renewal?" },
  { icon: AlertTriangle, title: "Likely to fail",       prompt: "Which controls are most likely to fail?" },
  { icon: TrendingUp,    title: "Recurring patterns",   prompt: "Any patterns in our recurring findings?" },
  { icon: Search,        title: "Control deep-dive",    prompt: "Summarise our audit history for CC6.6" },
];

const NO_SCROLLBAR = "no-scrollbar overflow-y-auto";

/* ── small pieces ────────────────────────────────────────────────────── */
function ReadinessRing({ pct }: { pct: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const color = pct >= 80 ? "#34d399" : pct >= 60 ? "#fbbf24" : "#f87171";
  return (
    <div className="relative h-[88px] w-[88px] shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1), stroke 300ms" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[20px] font-semibold leading-none text-white">{pct}</span>
        <span className="mt-0.5 text-[9px] uppercase tracking-widest text-white/30">score</span>
      </div>
    </div>
  );
}

function ControlRow({ ctrl }: { ctrl: ControlStatus }) {
  const s = STATUS_STYLE[ctrl.status];
  const issues = ctrl.liveIssues + ctrl.auditIssues;
  return (
    <div className="group flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/10 hover:bg-white/[0.04]">
      <span className={cn("h-2 w-2 shrink-0 rounded-full", s.dot)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11.5px] font-semibold text-white/80">{ctrl.controlId}</span>
          <span className={cn("text-[9.5px] font-medium uppercase tracking-wider", s.text)}>{s.label}</span>
        </div>
        <p className="truncate text-[11px] text-white/35">{ctrl.title}</p>
      </div>
      {issues > 0 && (
        <span className="shrink-0 rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-white/50">
          {issues}
        </span>
      )}
    </div>
  );
}

function MemoryCard({ memory }: { memory: Memory }) {
  const ICONS: Record<string, React.ReactNode> = {
    finding:       <AlertTriangle className="h-3 w-3 text-red-400"     />,
    remediation:   <CheckCircle2  className="h-3 w-3 text-emerald-400" />,
    control_test:  <Shield        className="h-3 w-3 text-blue-400"    />,
    agent_insight: <Sparkles      className="h-3 w-3 text-violet-400"  />,
  };
  const pct = Math.round((memory.relevance_score ?? 0) * 100);
  const barColor = pct > 80 ? "#34d399" : pct > 60 ? "#fbbf24" : "#f87171";

  return (
    <div className="space-y-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 transition-colors hover:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {ICONS[memory.memory_type] ?? <Database className="h-3 w-3 text-white/30" />}
          <span className="text-[9.5px] font-medium uppercase tracking-wider text-white/35">
            {memory.memory_type.replace(/_/g, " ")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {memory.control_id && (
            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9.5px] text-white/40">
              {memory.control_id}
            </span>
          )}
          <span className="font-mono text-[9.5px] text-white/30">{pct}%</span>
        </div>
      </div>
      <p className="line-clamp-3 text-[11.5px] leading-relaxed text-white/55">{memory.summary}</p>
      <div className="flex items-center gap-2">
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.05]">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
        </div>
        {memory.created_at && (
          <span className="text-[9.5px] text-white/20">
            {new Date(memory.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        )}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {}
      }}
      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/70"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ChatMessage({ msg }: { msg: Message }) {
  if (msg.role === "user") {
    return (
      <div className="ar-fade flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-white/[0.08] px-4 py-2.5 text-[14px] leading-relaxed text-white/90">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="ar-fade flex gap-3.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-white/[0.10] to-white/[0.02]">
        <Shield className="h-3.5 w-3.5 text-white/70" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[12px] font-medium text-white/60">AuditReady</span>
          <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9.5px] text-white/25">
            #{msg.interactionNumber}
          </span>
        </div>

        {msg.isError ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-[13px] text-red-300">
            {msg.content}
          </div>
        ) : (
          <div className="text-[14px] leading-relaxed text-white/80">
            <MarkdownMessage content={msg.content} />
          </div>
        )}

        {!msg.isError && (
          <div className="mt-2 flex items-center gap-1">
            <CopyButton text={msg.content} />
            {msg.memoriesUsed && msg.memoriesUsed.length > 0 && (
              <span className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-white/30">
                <Database className="h-3 w-3" />
                {msg.memoriesUsed.length} memor{msg.memoriesUsed.length === 1 ? "y" : "ies"} recalled
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="ar-fade flex gap-3.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-white/[0.10] to-white/[0.02]">
        <Shield className="h-3.5 w-3.5 text-white/70" />
      </div>
      <div className="flex items-center gap-3 pt-1.5">
        <div className="flex items-center gap-1">
          <span className="ar-dot h-1.5 w-1.5 rounded-full bg-white/50" style={{ animationDelay: "0ms" }} />
          <span className="ar-dot h-1.5 w-1.5 rounded-full bg-white/50" style={{ animationDelay: "150ms" }} />
          <span className="ar-dot h-1.5 w-1.5 rounded-full bg-white/50" style={{ animationDelay: "300ms" }} />
        </div>
        <span className="text-[12.5px] text-white/30">Recalling memories and reasoning…</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════════════ */
export function CompliancePage() {
  const { workspaceId } = useWorkspace();
  const { latestAlert, dismissAlert } = useAuditAlerts(workspaceId);

  const [messages,       setMessages      ] = useState<Message[]>([]);
  const [input,          setInput         ] = useState("");
  const [sending,        setSending       ] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [interactionNum, setInteractionNum] = useState(1);
  const [latestMemories, setLatestMemories] = useState<Memory[]>([]);
  const [controlsStatus, setControlsStatus] = useState<ControlStatus[]>([]);
  const [seeding,        setSeeding       ] = useState(false);
  const [seeded,         setSeeded        ] = useState(false);
  const [panelOpen,      setPanelOpen     ] = useState(true);
  const [tab,            setTab           ] = useState<"controls" | "memory">("controls");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const resizeInput = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);

  useEffect(() => { resizeInput(); }, [input, resizeInput]);

  const newChat = () => {
    setMessages([]);
    setConversationId(null);
    setInteractionNum(1);
    setLatestMemories([]);
    setInput("");
    inputRef.current?.focus();
  };

  const seedData = async () => {
    if (!workspaceId) return;
    setSeeding(true);
    try {
      const res = await fetch("/api/audit-ready/seed", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ workspaceId }),
      });
      if (res.ok) setSeeded(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSeeding(false);
    }
  };

  const sendMessage = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || !workspaceId || sending) return;
    setSending(true);

    setMessages(prev => [
      ...prev,
      { id: `user_${Date.now()}`, role: "user", content: text, interactionNumber: interactionNum },
    ]);
    setInput("");

    try {
      const res = await fetch("/api/audit-ready/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ workspaceId, message: text, conversationId }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data) {
        setMessages(prev => [
          ...prev,
          {
            id:                data.message?.id ?? `agent_${Date.now()}`,
            role:              "agent",
            content:           data.answer,
            interactionNumber: data.interactionNumber,
            memoriesUsed:      data.memoriesUsed ?? [],
          },
        ]);
        setConversationId(data.conversationId);
        setInteractionNum(data.interactionNumber + 1);
        setLatestMemories(data.memoriesUsed ?? []);
        setControlsStatus(data.controlsStatus ?? []);
      } else {
        setMessages(prev => [
          ...prev,
          {
            id:                `err_${Date.now()}`,
            role:              "agent",
            content:           data?.error ?? "Something went wrong. Please try again.",
            interactionNumber: interactionNum,
            isError:           true,
          },
        ]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          id:                `err_${Date.now()}`,
          role:              "agent",
          content:           "Network error. Check your connection and try again.",
          interactionNumber: interactionNum,
          isError:           true,
        },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const passingCount = controlsStatus.filter(c => c.status === "PASSING").length;
  const failingCount = controlsStatus.filter(c => c.status === "FAILING").length;
  const reviewCount  = controlsStatus.filter(c => c.status === "NEEDS_REVIEW").length;
  const readinessPct = controlsStatus.length > 0
    ? Math.round((passingCount / controlsStatus.length) * 100)
    : null;

  const canSend = input.trim().length > 0 && !sending;

  return (
    <div className="flex h-full overflow-hidden text-white" style={{ backgroundColor: "#0a0a0a" }}>
      <style>{`
        .no-scrollbar{scrollbar-width:none;-ms-overflow-style:none}
        .no-scrollbar::-webkit-scrollbar{display:none}
        @keyframes ar-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        .ar-fade{animation:ar-fade .35s cubic-bezier(.2,.8,.2,1) both}
        @keyframes ar-dot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
        .ar-dot{animation:ar-dot 1.1s infinite ease-in-out}
      `}</style>

      {/* ── CHAT COLUMN ─────────────────────────────────────────────── */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* ambient glow */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-60"
          style={{ background: "radial-gradient(60% 100% at 50% 0%, rgba(120,119,198,0.12), transparent)" }}
        />

        {/* header */}
        <header className="relative z-10 flex h-[56px] shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0a0a0a]/70 px-5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.10] to-white/[0.02]">
              <ShieldCheck className="h-4 w-4 text-white/80" />
            </div>
            <div className="leading-tight">
              <h1 className="text-[13.5px] font-semibold tracking-tight">AuditReady</h1>
              <p className="text-[10.5px] text-white/30">SOC 2 copilot · interaction #{interactionNum}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!seeded ? (
              <button
                onClick={seedData}
                disabled={seeding}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11.5px] text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/80 disabled:opacity-40"
              >
                {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
                {seeding ? "Loading…" : "Load audit history"}
              </button>
            ) : (
              <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-[11.5px] text-emerald-400">History loaded</span>
              </div>
            )}
            <button
              onClick={newChat}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11.5px] text-white/50 transition-colors hover:bg-white/[0.08] hover:text-white/80"
            >
              <Plus className="h-3.5 w-3.5" />
              New chat
            </button>
            <button
              onClick={() => setPanelOpen(o => !o)}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white/80"
              aria-label="Toggle insights panel"
            >
              {panelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* proactive alert banner */}
        {latestAlert && (
          <div className="ar-fade relative z-10 shrink-0 border-b border-red-500/20 bg-red-500/[0.05] px-5 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-red-500/15">
                  <Zap className="h-3.5 w-3.5 text-red-400" />
                </div>
                <div className="min-w-0">
                  <div className="mb-0.5 flex items-center gap-2">
                    <p className="text-[12px] font-semibold text-red-400">
                      ⚠ Proactive compliance alert
                    </p>
                    {latestAlert.recurringGaps > 0 && (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[9.5px] font-medium text-red-400">
                        RECURRING
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] leading-relaxed text-white/55">
                    New scan detected{" "}
                    <strong className="text-white/75">{latestAlert.criticalGaps} critical</strong> issue
                    {latestAlert.criticalGaps !== 1 ? "s" : ""} breaking SOC 2{" "}
                    <strong className="text-white/75">{latestAlert.topGap?.controlId}</strong>.
                    {latestAlert.topGap?.isRecurring && (
                      <>
                        {" "}Previously seen as:{" "}
                        <span className="text-red-400/70">
                          &ldquo;{latestAlert.topGap.previousFinding}&rdquo;
                        </span>
                        . This is a recurring pattern.
                      </>
                    )}
                  </p>
                  <button
                    onClick={() => {
                      setInput(
                        `Tell me about the new compliance gap in ${latestAlert.topGap?.controlId} — is this a recurring issue?`
                      );
                      dismissAlert();
                      inputRef.current?.focus();
                    }}
                    className="mt-1.5 text-[11px] text-red-400/70 underline transition-colors hover:text-red-400"
                  >
                    Ask AuditReady about this →
                  </button>
                </div>
              </div>
              <button
                onClick={dismissAlert}
                aria-label="Dismiss alert"
                className="shrink-0 text-white/20 transition-colors hover:text-white/50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* messages */}
        <div className={cn("relative flex-1", NO_SCROLLBAR)}>
          {messages.length === 0 ? (
            <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center px-6 pb-8 text-center">
              <div className="ar-fade mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.10] to-white/[0.02] shadow-[0_0_60px_rgba(120,119,198,0.25)]">
                <ShieldCheck className="h-6 w-6 text-white/80" />
              </div>
              <h2
                className="ar-fade bg-gradient-to-b from-white to-white/50 bg-clip-text text-[28px] font-semibold tracking-tight text-transparent"
                style={{ animationDelay: "60ms" }}
              >
                Audit-ready, always.
              </h2>
              <p
                className="ar-fade mt-3 max-w-md text-[13.5px] leading-relaxed text-white/35"
                style={{ animationDelay: "120ms" }}
              >
                Ask anything about your SOC 2 posture. I remember your full audit history and cross-check it against live security findings.
              </p>

              <div className="mt-8 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                {STARTERS.map((s, i) => (
                  <button
                    key={s.title}
                    onClick={() => sendMessage(s.prompt)}
                    disabled={!workspaceId}
                    className="ar-fade group flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.05] disabled:opacity-40"
                    style={{ animationDelay: `${180 + i * 60}ms` }}
                  >
                    <s.icon className="mt-0.5 h-4 w-4 shrink-0 text-white/40 transition-colors group-hover:text-white/80" />
                    <div>
                      <p className="text-[12.5px] font-medium text-white/80">{s.title}</p>
                      <p className="mt-0.5 text-[11.5px] leading-snug text-white/35">{s.prompt}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-7 px-6 py-8">
              {messages.map(msg => <ChatMessage key={msg.id} msg={msg} />)}
              {sending && <TypingIndicator />}
              <div ref={bottomRef} className="h-4" />
            </div>
          )}
        </div>

        {/* input */}
        <div className="relative z-10 shrink-0 px-6 pb-4 pt-2">
          <div
            className="pointer-events-none absolute inset-x-0 -top-10 h-10"
            style={{ background: "linear-gradient(to top, #0a0a0a, transparent)" }}
          />
          <div className="mx-auto max-w-3xl">
            <div className="rounded-3xl border border-white/10 bg-[#141414] shadow-[0_10px_50px_rgba(0,0,0,0.55)] transition-colors focus-within:border-white/25">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask about your compliance status…"
                rows={1}
                className="no-scrollbar block w-full resize-none bg-transparent px-5 pb-1 pt-4 text-[14.5px] leading-relaxed text-white placeholder:text-white/25 focus:outline-none"
                style={{ minHeight: "28px", maxHeight: "200px" }}
              />
              <div className="flex items-center justify-between px-3 pb-3 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10.5px] text-white/40">
                    <Database className="h-3 w-3" /> Memory
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10.5px] text-white/40">
                    <Activity className="h-3 w-3" /> Live findings
                  </span>
                </div>
                <button
                  onClick={() => sendMessage()}
                  disabled={!canSend}
                  aria-label="Send message"
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full transition-all",
                    canSend
                      ? "bg-white text-black hover:scale-105 hover:bg-white/90 active:scale-95"
                      : "bg-white/[0.07] text-white/25"
                  )}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2.5} />}
                </button>
              </div>
            </div>
            <p className="mt-2 text-center text-[10.5px] text-white/20">
              AuditReady can make mistakes. Verify findings before sharing with auditors.
            </p>
          </div>
        </div>
      </div>

      {/* ── INSIGHTS PANEL ──────────────────────────────────────────── */}
      <aside
        className={cn(
          "shrink-0 overflow-hidden border-l border-white/[0.06] bg-[#0c0c0c] transition-all duration-300",
          panelOpen ? "w-[340px]" : "w-0 border-l-0"
        )}
      >
        <div className="flex h-full w-[340px] flex-col">
          {/* readiness */}
          <div className="border-b border-white/[0.06] p-5">
            <p className="mb-4 text-[10.5px] font-medium uppercase tracking-widest text-white/30">
              SOC 2 Readiness
            </p>
            {readinessPct !== null ? (
              <div className="flex items-center gap-5">
                <ReadinessRing pct={readinessPct} />
                <div className="flex-1 space-y-2">
                  {[
                    { label: "Passing", n: passingCount, dot: "bg-emerald-400" },
                    { label: "Review",  n: reviewCount,  dot: "bg-amber-400"   },
                    { label: "Failing", n: failingCount, dot: "bg-red-400"     },
                  ].map(r => (
                    <div key={r.label} className="flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-2 text-white/45">
                        <span className={cn("h-1.5 w-1.5 rounded-full", r.dot)} />
                        {r.label}
                      </span>
                      <span className="font-mono text-white/70">{r.n}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[12px] leading-relaxed text-white/25">
                Send a message to compute your live control scorecard.
              </p>
            )}
          </div>

          {/* tabs */}
          <div className="flex gap-1 border-b border-white/[0.06] p-2">
            {([
              { id: "controls", label: "Controls", icon: ListChecks, count: controlsStatus.length  },
              { id: "memory",   label: "Memory",   icon: Database,   count: latestMemories.length },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11.5px] font-medium transition-colors",
                  tab === t.id
                    ? "bg-white/[0.08] text-white"
                    : "text-white/35 hover:bg-white/[0.04] hover:text-white/70"
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {t.count > 0 && (
                  <span className="rounded-full bg-white/10 px-1.5 text-[9.5px] text-white/60">{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* tab content */}
          <div className={cn("flex-1 space-y-2 p-3", NO_SCROLLBAR)}>
            {tab === "controls" ? (
              controlsStatus.length === 0 ? (
                <EmptyPanel icon={ListChecks} title="No controls scored yet" body="Ask a question to see per-control status." />
              ) : (
                controlsStatus.map(c => <ControlRow key={c.controlId} ctrl={c} />)
              )
            ) : latestMemories.length === 0 ? (
              <EmptyPanel icon={Database} title="No memories recalled yet" body="See which past findings the agent pulls into each answer." />
            ) : (
              <>
                <div className="mb-1 flex items-center gap-1.5 px-1">
                  <Zap className="h-3 w-3 text-white/30" />
                  <p className="text-[10.5px] text-white/30">Recalled for last response</p>
                </div>
                {latestMemories.map((m, i) => <MemoryCard key={i} memory={m} />)}
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

function EmptyPanel({
  icon: Icon, title, body,
}: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <Icon className="h-4 w-4 text-white/20" />
      </div>
      <p className="text-[12px] font-medium text-white/40">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-white/20">{body}</p>
    </div>
  );
}
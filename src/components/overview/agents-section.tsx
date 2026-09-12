"use client";

import { useState, useEffect, useCallback, useId } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import {
  Eye, EyeOff, Loader2, Check, X, Plug, Zap,
  ChevronDown, ExternalLink, AlertCircle, Sparkles,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────── */
interface ConnectedKey {
  provider: string;
  model:    string;
  keyHint:  string;
}

interface AgentDef {
  id:             string;
  name:           string;
  connectLabel:   string;
  connectStyle:   "default" | "highlight";
  imagePath:      string;
  imageAlt:       string;
  recommended?:   boolean;
  // API-connectable agents have these extra fields
  provider?:      string;
  keyLabel?:      string;
  keyPlaceholder?:string;
  keyHint?:       string;
  docsUrl?:       string;
  models?:        { id: string; name: string }[];
}

/* ─── Agent definitions ──────────────────────────────────────────────── */
const AGENTS: AgentDef[] = [
  // ── API-connectable (real key storage) ──
  {
    id: "claude", name: "Claude",
    connectLabel: "Connect via API",
    connectStyle: "default",
    imagePath: "/agents/claude-desktop.png",
    imageAlt: "Claude by Anthropic",
    recommended: true,
    provider: "claude",
    keyLabel: "Anthropic API key",
    keyPlaceholder: "sk-ant-api03-…",
    keyHint: "Starts with sk-ant-",
    docsUrl: "https://console.anthropic.com/keys",
    models: [
      { id: "claude-opus-4-5",   name: "Claude Opus 4.5" },
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
      { id: "claude-haiku-4-5",  name: "Claude Haiku 4.5" },
    ],
  },
  {
    id: "openai", name: "GPT-4",
    connectLabel: "Connect via API",
    connectStyle: "default",
    imagePath: "/agents/codex.png",
    imageAlt: "GPT-4 by OpenAI",
    provider: "openai",
    keyLabel: "OpenAI API key",
    keyPlaceholder: "sk-proj-…",
    keyHint: "Starts with sk-proj-",
    docsUrl: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-4o",       name: "GPT-4o" },
      { id: "gpt-4o-mini",  name: "GPT-4o Mini" },
      { id: "gpt-4-turbo",  name: "GPT-4 Turbo" },
    ],
  },
  {
    id: "gemini", name: "Gemini",
    connectLabel: "Connect via API",
    connectStyle: "default",
    imagePath: "/agents/gemini.png",
    imageAlt: "Gemini by Google",
    provider: "gemini",
    keyLabel: "Google AI Studio key",
    keyPlaceholder: "AIzaSy…",
    keyHint: "Starts with AIzaSy",
    docsUrl: "https://aistudio.google.com/apikey",
    models: [
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
      { id: "gemini-1.5-pro",   name: "Gemini 1.5 Pro" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
    ],
  },
  {
    id: "mistral", name: "OpenClaw",
    connectLabel: "Connect via API",
    connectStyle: "default",
    imagePath: "/agents/openclaw.png",
    imageAlt: "Mistral AI",
    provider: "mistral",
    keyLabel: "OpenClaw API key",
    keyPlaceholder: "Paste your key",
    docsUrl: "https://console.mistral.ai/api-keys",
    models: [
      { id: "mistral-large-latest",  name: "Mistral Large" },
      { id: "mistral-medium-latest", name: "Mistral Medium" },
      { id: "mistral-small-latest",  name: "Mistral Small" },
    ],
  },
  // ── MCP / prompts tools (UI only) ──
  // {
  //   id: "claude-desktop", name: "Claude Desktop",
  //   connectLabel: "Connect via MCP", connectStyle: "default",
  //   imagePath: "/agents/claude-desktop.png", imageAlt: "Claude Desktop",
  // },
  {
    id: "cursor", name: "Cursor",
    connectLabel: "Connect via MCP", connectStyle: "default",
    imagePath: "/agents/cursor.png", imageAlt: "Cursor",
  },
  {
    id: "vscode", name: "VS Code",
    connectLabel: "Connect via MCP", connectStyle: "default",
    imagePath: "/agents/vscode.png", imageAlt: "VS Code",
  },
  {
    id: "cline", name: "Cline",
    connectLabel: "Connect via MCP", connectStyle: "highlight",
    imagePath: "/agents/cline.png", imageAlt: "Cline",
  },
  {
    id: "hermes", name: "Hermes Agent",
    connectLabel: "Connect via MCP", connectStyle: "default",
    imagePath: "/agents/hermes.png", imageAlt: "Hermes Agent",
  },
  {
    id: "api-mcp", name: "API / MCP",
    connectLabel: "Connect via API or MCP", connectStyle: "default",
    imagePath: "/agents/api-mcp.png", imageAlt: "API / MCP",
  },
];

/* ─── Shared bits ─────────────────────────────────────────────────────── */
function StatusDot({ tone }: { tone: "connected" | "idle" }) {
  return (
    <span className="relative flex h-1.5 w-1.5">
      {tone === "connected" && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
      )}
      <span
        className={cn(
          "relative inline-flex h-1.5 w-1.5 rounded-full",
          tone === "connected" ? "bg-emerald-400" : "bg-white/20",
        )}
      />
    </span>
  );
}

function AgentGlyph({ agent }: { agent: AgentDef }) {
  return (
    <div className="relative h-24 w-full">
      <Image
        src={agent.imagePath}
        alt={agent.imageAlt}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
        className="object-contain object-bottom drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-out group-hover:scale-[1.04]"
        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    </div>
  );
}

/* ─── API card (connectable) ─────────────────────────────────────────── */
function ApiAgentCard({
  agent, connectedKey, onRefresh,
}: {
  agent: AgentDef;
  connectedKey: ConnectedKey | null;
  onRefresh: () => void;
}) {
  const uid = useId();
  const [expanded, setExpanded] = useState(false);
  const [apiKey, setApiKey]     = useState("");
  const [showKey, setShowKey]   = useState(false);
  const [model, setModel]       = useState(agent.models?.[0]?.id ?? "");
  const [saving, setSaving]     = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const isConnected = !!connectedKey;

  const handleConnect = async () => {
    if (!apiKey.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/agents/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: agent.provider, apiKey: apiKey.trim(), model }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "That key didn't validate — double-check and try again.");
        return;
      }
      setApiKey("");
      setExpanded(false);
      onRefresh();
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (removing) return;
    setRemoving(true);
    try {
      await fetch("/api/agents/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: agent.provider }),
      });
      onRefresh();
    } finally {
      setRemoving(false);
    }
  };

  const closeForm = () => {
    setExpanded(false);
    setApiKey("");
    setError(null);
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border transition-colors duration-200",
        isConnected
          ? "border-emerald-400/20 bg-emerald-400/[0.03]"
          : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.035]",
      )}
      style={{ minHeight: "208px" }}
    >
      {/* top-right status */}
      <div className="absolute right-3.5 top-3.5 z-[1] flex items-center gap-1.5">
        {agent.recommended && !isConnected && (
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-medium text-primary">
            <Sparkles className="h-2.5 w-2.5" />
            Native
          </span>
        )}
        {isConnected && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-1 text-[9px] font-medium text-emerald-400">
            <StatusDot tone="connected" />
            Connected
          </span>
        )}
      </div>

      {/* name + meta */}
      <div className="p-4 pb-0">
        <p className="text-[13px] font-semibold leading-tight text-white">{agent.name}</p>
        <p className="mt-1 text-[10px] leading-tight text-white/30">
          {isConnected && connectedKey
            ? `${connectedKey.model} · key ····${connectedKey.keyHint}`
            : agent.keyLabel}
        </p>
      </div>

      {/* glyph */}
      <div className="relative flex flex-1 items-end justify-center px-4 pb-14 pt-2">
        <AgentGlyph agent={agent} />
      </div>

      {/* action button */}
      <div className="absolute bottom-3.5 left-3.5 right-3.5">
        {isConnected ? (
          <button
            onClick={handleRemove}
            disabled={removing}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] py-1.5 text-[11px] font-medium text-white/40 transition-colors duration-150 hover:border-red-500/30 hover:bg-red-500/[0.06] hover:text-red-400 disabled:opacity-50"
          >
            {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            Disconnect
          </button>
        ) : (
          <button
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[11px] font-medium transition-colors duration-150",
              expanded
                ? "border-white/[0.14] bg-white/[0.06] text-white/70"
                : "border-white/[0.09] bg-white/[0.04] text-white/55 hover:border-primary/30 hover:bg-primary/[0.06] hover:text-white",
            )}
          >
            <Zap className="h-3 w-3" />
            {expanded ? "Cancel" : agent.connectLabel}
          </button>
        )}
      </div>

      {/* expandable form — overlays card */}
      {expanded && !isConnected && (
        <div
          className="absolute inset-0 z-10 flex flex-col justify-center gap-3 rounded-2xl border border-white/[0.08] p-4"
          style={{ backgroundColor: "#0D0D12" }}
        >
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold text-white">{agent.name}</p>
            <button
              onClick={closeForm}
              aria-label="Close"
              className="rounded-md p-0.5 text-white/25 transition-colors hover:text-white/60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* key input */}
          <div className="space-y-1">
            <label htmlFor={`${uid}-key`} className="text-[9.5px] font-medium tracking-wide text-white/35">
              {agent.keyLabel}
            </label>
            <div className="relative">
              <input
                id={`${uid}-key`}
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={e => { setApiKey(e.target.value); if (error) setError(null); }}
                onKeyDown={e => e.key === "Enter" && handleConnect()}
                placeholder={agent.keyPlaceholder}
                autoComplete="off"
                spellCheck={false}
                className={cn(
                  "w-full rounded-lg border bg-white/[0.04] px-3 py-2 pr-8 text-[11px] text-white placeholder:text-white/15 focus:outline-none focus:ring-1",
                  error
                    ? "border-red-500/40 focus:border-red-500/50 focus:ring-red-500/20"
                    : "border-white/[0.09] focus:border-primary/50 focus:ring-primary/20",
                )}
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                aria-label={showKey ? "Hide key" : "Show key"}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/20 transition-colors hover:text-white/50"
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            {agent.keyHint && !error && (
              <p className="text-[9px] text-white/20">{agent.keyHint}</p>
            )}
          </div>

          {/* model selector */}
          {agent.models && agent.models.length > 0 && (
            <div className="space-y-1">
              <label htmlFor={`${uid}-model`} className="text-[9.5px] font-medium tracking-wide text-white/35">
                Model
              </label>
              <div className="relative">
                <select
                  id={`${uid}-model`}
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-white/[0.09] bg-white/[0.04] px-3 py-2 pr-7 text-[11px] text-white/75 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
                >
                  {agent.models.map(m => (
                    <option key={m.id} value={m.id} className="bg-[#111]">{m.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-white/25" />
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="flex items-start gap-1.5 text-[10px] leading-snug text-red-400">
              <AlertCircle className="mt-[1px] h-3 w-3 shrink-0" />
              {error}
            </p>
          )}

          <button
            onClick={handleConnect}
            disabled={saving || !apiKey.trim()}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-[11px] font-semibold text-white transition-colors duration-150 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Validating…</>
              : <><Check className="h-3.5 w-3.5" /> Connect</>}
          </button>

          {agent.docsUrl && (
            <a
              href={agent.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 text-[9.5px] text-white/25 transition-colors hover:text-white/50"
            >
              Get an API key <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Plain MCP/prompts card (no API key) ────────────────────────────── */
function PlainAgentCard({ agent }: { agent: AgentDef }) {
  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] transition-colors duration-200 hover:border-white/[0.14] hover:bg-white/[0.035]"
      style={{ minHeight: "208px" }}
    >
      <div className="p-4 pb-0">
        <p className="text-[13px] font-semibold leading-tight text-white">{agent.name}</p>
        <p className="mt-1 text-[10px] leading-tight text-white/30">
          {agent.connectStyle === "highlight" ? "Popular integration" : "Local integration"}
        </p>
      </div>

      <div className="relative flex flex-1 items-end justify-center px-4 pb-14 pt-2">
        <AgentGlyph agent={agent} />
      </div>

      <div className="absolute bottom-3.5 left-3.5 right-3.5">
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium transition-colors duration-150",
            agent.connectStyle === "highlight"
              ? "bg-violet-600 text-white hover:bg-violet-500"
              : "border border-white/[0.09] bg-white/[0.04] text-white/55 hover:border-white/[0.18] hover:text-white/85",
          )}
        >
          <Plug className="h-3 w-3" />
          {agent.connectLabel}
        </button>
      </div>
    </div>
  );
}

/* ─── Loading skeleton ────────────────────────────────────────────────── */
function CardSkeleton() {
  return (
    <div
      className="animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.015]"
      style={{ minHeight: "208px" }}
    >
      <div className="p-4">
        <div className="h-3 w-16 rounded bg-white/[0.06]" />
        <div className="mt-2 h-2 w-24 rounded bg-white/[0.04]" />
      </div>
    </div>
  );
}

/* ─── Main section ───────────────────────────────────────────────────── */
export function AgentsSection() {
  const [connectedKeys, setConnectedKeys] = useState<ConnectedKey[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/keys");
      const data = await res.json();
      setConnectedKeys(data.keys ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const apiAgents   = AGENTS.filter(a => a.provider);
  const plainAgents = AGENTS.filter(a => !a.provider);
  const connCount   = connectedKeys.length;

  return (
    <div className="mt-10 space-y-6">
      {/* header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-semibold text-white">Agents</h2>
          {connCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-primary/[0.12] px-2 py-0.5 text-[10px] font-medium text-primary">
              <StatusDot tone="connected" />
              {connCount} connected
            </span>
          )}
        </div>
        <p className="max-w-xl text-[13px] leading-relaxed text-white/35">
          Connect API keys to use Claude, GPT-4, Gemini, or Mistral as your RAG generation
          model
        </p>
      </div>

      {/* API-connectable agents */}
      <section>
        <p className="mb-2.5 text-[10.5px] font-medium text-white/25">
          AI models · connect your own API key
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {loading
            ? [1, 2, 3, 4].map(i => <CardSkeleton key={i} />)
            : apiAgents.map(agent => (
                <ApiAgentCard
                  key={agent.id}
                  agent={agent}
                  connectedKey={connectedKeys.find(k => k.provider === agent.provider) ?? null}
                  onRefresh={fetchKeys}
                />
              ))}
        </div>
      </section>

      {/* Plain MCP tools */}
      <section>
        <p className="mb-2.5 text-[10.5px] font-medium text-white/25">
          Coding tools &amp; agents · connect via MCP or prompts
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {plainAgents.map(agent => (
            <PlainAgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </section>

      {/* model switch hint */}
      {connCount > 0 && (
        <p className="flex items-center gap-1.5 text-[10.5px] text-white/20">
          <Check className="h-3 w-3 text-emerald-400/70" />
          Connected models are ready to use in Chat — switch anytime mid-conversation.
        </p>
      )}
    </div>
  );
}
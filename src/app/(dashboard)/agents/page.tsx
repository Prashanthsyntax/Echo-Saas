"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentProvider {
  id: string;
  name: string;
  description: string;
  docsUrl: string;
  keyPrefix: string;
  keyPlaceholder: string;
  models: { id: string; label: string; recommended?: boolean }[];
  accentColor: string;
  icon: string;
}

const PROVIDERS: AgentProvider[] = [
  {
    id: "claude",
    name: "Claude (Anthropic)",
    description: "Best for nuanced reasoning, long documents, and precise answers.",
    docsUrl: "https://console.anthropic.com/api-keys",
    keyPrefix: "sk-ant-",
    keyPlaceholder: "sk-ant-api03-...",
    models: [
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", recommended: true },
      { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    ],
    accentColor: "#d4a574",
    icon: "🔶",
  },
  {
    id: "openai",
    name: "OpenAI (GPT-4)",
    description: "Industry-standard model, great for structured outputs and code.",
    docsUrl: "https://platform.openai.com/api-keys",
    keyPrefix: "sk-",
    keyPlaceholder: "sk-...",
    models: [
      { id: "gpt-4o", label: "GPT-4o", recommended: true },
      { id: "gpt-4o-mini", label: "GPT-4o mini (faster)" },
      { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
    ],
    accentColor: "#10a37f",
    icon: "🟢",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    description: "Excellent at multimodal understanding and long context windows.",
    docsUrl: "https://aistudio.google.com/app/apikey",
    keyPrefix: "AI",
    keyPlaceholder: "AIza...",
    models: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", recommended: true },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    ],
    accentColor: "#4285f4",
    icon: "🔷",
  },
  {
    id: "mistral",
    name: "Mistral AI",
    description: "Fast European alternative, strong at multilingual content.",
    docsUrl: "https://console.mistral.ai/api-keys",
    keyPrefix: "",
    keyPlaceholder: "...",
    models: [
      { id: "mistral-large-latest", label: "Mistral Large", recommended: true },
      { id: "mistral-small-latest", label: "Mistral Small (faster)" },
    ],
    accentColor: "#ff7000",
    icon: "🟠",
  },
];

interface ConnectedKey {
  id: string;
  provider: string;
  model: string;
  keyHint: string;
  isActive: boolean;
  createdAt: string;
}

interface FormState {
  apiKey: string;
  model: string;
  showKey: boolean;
  status: "idle" | "validating" | "success" | "error";
  message: string;
}

export default function AgentsPage() {
  const [connectedKeys, setConnectedKeys] = useState<ConnectedKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agents/keys")
      .then((r) => r.json())
      .then((data) => {
        setConnectedKeys(data.keys ?? []);
        setLoading(false);
      });
  }, []);

  const getForm = (providerId: string): FormState =>
    forms[providerId] ?? {
      apiKey: "",
      model: PROVIDERS.find((p) => p.id === providerId)?.models.find((m) => m.recommended)?.id ?? "",
      showKey: false,
      status: "idle",
      message: "",
    };

  const updateForm = (providerId: string, updates: Partial<FormState>) => {
    setForms((prev) => ({
      ...prev,
      [providerId]: { ...getForm(providerId), ...updates },
    }));
  };

  const handleConnect = async (provider: AgentProvider) => {
    const form = getForm(provider.id);
    if (!form.apiKey.trim() || !form.model) return;

    updateForm(provider.id, { status: "validating", message: "Validating key..." });

    try {
      const res = await fetch("/api/agents/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: provider.id,
          apiKey: form.apiKey.trim(),
          model: form.model,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        updateForm(provider.id, {
          status: "error",
          message: data.error ?? "Connection failed",
        });
        return;
      }

      setConnectedKeys((prev) => {
        const filtered = prev.filter((k) => k.provider !== provider.id);
        return [...filtered, data];
      });

      updateForm(provider.id, {
        status: "success",
        message: `✓ Connected to ${provider.name}`,
        apiKey: "",
      });

      setExpandedProvider(null);
      setTimeout(() => updateForm(provider.id, { status: "idle", message: "" }), 3000);
    } catch {
      updateForm(provider.id, {
        status: "error",
        message: "Network error — please try again",
      });
    }
  };

  const handleDisconnect = async (providerId: string) => {
    if (!confirm("Disconnect this agent? Your API key will be deleted.")) return;

    await fetch("/api/agents/keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: providerId }),
    });

    setConnectedKeys((prev) => prev.filter((k) => k.provider !== providerId));
  };

  const connectedProviderIds = new Set(connectedKeys.map((k) => k.provider));

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Connected agents</h1>
          <Badge
            className="border-0 text-xs"
            style={{
              backgroundColor: "rgba(139,92,246,0.15)",
              color: "#a78bfa",
            }}
          >
            <Sparkles className="mr-1 h-3 w-3" />
            echo-nemo-1.0 compatible
          </Badge>
        </div>
        <p className="mt-2 text-sm text-white/40">
          Connect your own AI API keys to use more powerful models in echo-nemo-1.0.
          Your documents stay in your private knowledge base — the agent just answers with better reasoning.
        </p>
      </div>

      {/* default model notice */}
      <div
        className="mb-8 flex items-start gap-3 rounded-xl border border-white/8 p-4"
        style={{ backgroundColor: "rgba(139,92,246,0.06)" }}
      >
        <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-medium text-white">
            Default: echo-nemo-1.0 (Groq Llama 3.3 70B)
          </p>
          <p className="mt-0.5 text-xs text-white/40">
            Already set up and free. Connect an agent below to upgrade the
            answering model while keeping the same RAG retrieval pipeline.
          </p>
        </div>
      </div>

      {/* provider cards */}
      <div className="space-y-3">
        {PROVIDERS.map((provider) => {
          const connected = connectedKeys.find((k) => k.provider === provider.id);
          const form = getForm(provider.id);
          const isExpanded = expandedProvider === provider.id;

          return (
            <div
              key={provider.id}
              className="overflow-hidden rounded-2xl border border-white/6"
              style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
            >
              {/* provider header */}
              <div className="flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{provider.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">
                        {provider.name}
                      </p>
                      {connected && (
                        <Badge
                          className="border-0 text-[10px]"
                          style={{
                            backgroundColor: "rgba(52,211,153,0.12)",
                            color: "#34d399",
                          }}
                        >
                          <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
                          Connected · {connected.model}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-white/30">
                      {provider.description}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {connected ? (
                    <button
                      onClick={() => handleDisconnect(provider.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400/70 transition-colors hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        setExpandedProvider(isExpanded ? null : provider.id)
                      }
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 transition-colors hover:border-white/20 hover:text-white/80"
                    >
                      {isExpanded ? "Cancel" : "Connect"}
                    </button>
                  )}
                </div>
              </div>

              {/* connection form */}
              {isExpanded && !connected && (
                <div className="border-t border-white/5 p-5 space-y-4">
                  {/* get key link */}
                  <a
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Get your API key from {provider.name}
                  </a>

                  {/* API key input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/40">
                      API Key
                    </label>
                    <div className="relative">
                      <Input
                        type={form.showKey ? "text" : "password"}
                        value={form.apiKey}
                        onChange={(e) =>
                          updateForm(provider.id, { apiKey: e.target.value, status: "idle" })
                        }
                        placeholder={provider.keyPlaceholder}
                        className="border-white/10 bg-white/5 pr-10 text-sm text-white placeholder:text-white/15 focus-visible:ring-primary/50"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateForm(provider.id, { showKey: !form.showKey })
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50"
                      >
                        {form.showKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* model select */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/40">
                      Model
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {provider.models.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() =>
                            updateForm(provider.id, { model: m.id })
                          }
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                            form.model === m.id
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-white/8 text-white/40 hover:border-white/15 hover:text-white/70"
                          )}
                        >
                          {m.label}
                          {m.recommended && (
                            <span className="ml-1.5 text-[10px] text-white/20">
                              recommended
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* status message */}
                  {form.status !== "idle" && (
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
                        form.status === "validating" && "text-white/40",
                        form.status === "success" && "text-emerald-400",
                        form.status === "error" && "text-red-400"
                      )}
                      style={{
                        backgroundColor:
                          form.status === "success"
                            ? "rgba(52,211,153,0.08)"
                            : form.status === "error"
                            ? "rgba(239,68,68,0.08)"
                            : "rgba(255,255,255,0.04)",
                      }}
                    >
                      {form.status === "validating" && (
                        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                      )}
                      {form.status === "success" && (
                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                      )}
                      {form.status === "error" && (
                        <AlertCircle className="h-3 w-3 shrink-0" />
                      )}
                      {form.message}
                    </div>
                  )}

                  {/* connect button */}
                  <Button
                    onClick={() => handleConnect(provider)}
                    disabled={
                      !form.apiKey.trim() ||
                      !form.model ||
                      form.status === "validating"
                    }
                    className="gap-2"
                    size="sm"
                  >
                    {form.status === "validating" ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Validating key...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Connect {provider.name}
                      </>
                    )}
                  </Button>

                  {/* security note */}
                  <p className="text-[10px] text-white/15">
                    🔒 Your API key is encrypted with AES-256-GCM before storage. We never log or expose it.
                  </p>
                </div>
              )}

              {/* connected summary */}
              {connected && (
                <div className="border-t border-white/5 px-5 py-3">
                  <div className="flex items-center gap-4 text-[11px] text-white/25">
                    <span>Key: {connected.keyHint}</span>
                    <span>Model: {connected.model}</span>
                    <span>
                      Connected{" "}
                      {new Date(connected.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
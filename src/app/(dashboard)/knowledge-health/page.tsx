/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/purity */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import {
  AlertTriangle, CheckCircle, Clock, Loader2,
  RefreshCw, FileText, Zap, Shield, TrendingDown,
  ChevronDown, ChevronUp, X, Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DecayDocument {
  source:      string;
  doc_type:    string;
  created_at:  string;
  half_life:   number;
  chunk_count: number;
  avg_decay:   number;
  is_stale:    boolean;
  is_warning:  boolean;
  is_fresh:    boolean;
}

interface Contradiction {
  id:             string;
  sourceDocA:     string;
  sourceDocB:     string;
  chunkTextA:     string;
  chunkTextB:     string;
  similarityScore: number;
  llmVerdict:     string;
  severity:       "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status:         "OPEN" | "RESOLVED" | "DISMISSED";
  createdAt:      string;
}

interface HealthData {
  documents:          DecayDocument[];
  contradictions:     Contradiction[];
  healthScore:        number;
  avgDecay:           number;
  staleCount:         number;
  warningCount:       number;
  freshCount:         number;
  openContradictions: number;
}

const SEVERITY_STYLES = {
  CRITICAL: "border-red-500/40 bg-red-500/10 text-red-400",
  HIGH:     "border-orange-500/40 bg-orange-500/10 text-orange-400",
  MEDIUM:   "border-amber-500/40 bg-amber-500/10 text-amber-400",
  LOW:      "border-zinc-500/40 bg-zinc-500/10 text-zinc-400",
};

const DOC_TYPE_ICONS: Record<string, string> = {
  pdf:        "📄",
  url:        "🔗",
  transcript: "🎥",
  video_notes:"🎥",
  docx:       "📝",
  doc:        "📝",
  csv:        "📊",
  txt:        "📋",
  md:         "📋",
};

function DecayBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 60 ? "bg-emerald-500" :
    pct >= 30 ? "bg-amber-500"   : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/5">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn(
        "text-[10px] font-mono",
        pct >= 60 ? "text-emerald-400" :
        pct >= 30 ? "text-amber-400"   : "text-red-400"
      )}>
        {pct}%
      </span>
    </div>
  );
}

function HealthCircle({ score }: { score: number }) {
  const color =
    score >= 70 ? "#10B981" :
    score >= 40 ? "#F59E0B" : "#EF4444";

  const r   = 54;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="relative flex h-36 w-36 items-center justify-center">
      <svg width="144" height="144" className="-rotate-90">
        <circle cx="72" cy="72" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10"/>
        <circle
          cx="72" cy="72" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold text-white">{score}</span>
        <span className="text-[10px] text-white/30">health score</span>
      </div>
    </div>
  );
}

export default function KnowledgeHealthPage() {
  const { workspaceId } = useWorkspace();
  const [data, setData]       = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedContradiction, setExpandedContradiction] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!workspaceId) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch(`/api/knowledge/decay?workspaceId=${workspaceId}`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [workspaceId]);

  useEffect(() => { fetchData(false); }, [fetchData]);

  const handleUpdateContradiction = async (
    id: string,
    status: "RESOLVED" | "DISMISSED"
  ) => {
    setUpdating(id);
    try {
      await fetch("/api/knowledge/contradiction", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contradictionId: id, status, workspaceId }),
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              contradictions: prev.contradictions.map((c) =>
                c.id === id ? { ...c, status } : c
              ),
              openContradictions: Math.max(0, prev.openContradictions - 1),
            }
          : prev
      );
    } finally {
      setUpdating(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });

  const daysAgo = (iso: string) => {
    const days = Math.floor(
      (Date.now() - new Date(iso).getTime()) / 86400000
    );
    return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-white/30">Analysing knowledge base health...</p>
        </div>
      </div>
    );
  }

  const openContradictions = data?.contradictions.filter((c) => c.status === "OPEN") ?? [];
  const resolvedContradictions = data?.contradictions.filter((c) => c.status !== "OPEN") ?? [];

  return (
    <div className="min-h-full p-8">
      <div className="mx-auto max-w-5xl space-y-8">

        {/* header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold text-white">Knowledge Health</h1>
            </div>
            <p className="mt-1 text-sm text-white/30">
              Temporal decay scores · Contradiction detection · Stale content alerts
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* ── OVERVIEW CARDS ── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            {
              label: "Health Score",
              value: `${data?.healthScore ?? 0}%`,
              icon: Shield,
              color: (data?.healthScore ?? 0) >= 70 ? "text-emerald-400" : (data?.healthScore ?? 0) >= 40 ? "text-amber-400" : "text-red-400",
              bg: (data?.healthScore ?? 0) >= 70 ? "rgba(16,185,129,0.08)" : (data?.healthScore ?? 0) >= 40 ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)",
            },
            {
              label: "Fresh",
              value: data?.freshCount ?? 0,
              icon: CheckCircle,
              color: "text-emerald-400",
              bg: "rgba(16,185,129,0.06)",
            },
            {
              label: "Warning",
              value: data?.warningCount ?? 0,
              icon: Clock,
              color: "text-amber-400",
              bg: "rgba(245,158,11,0.06)",
            },
            {
              label: "Stale",
              value: data?.staleCount ?? 0,
              icon: TrendingDown,
              color: "text-red-400",
              bg: "rgba(239,68,68,0.06)",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-white/5 p-4"
              style={{ backgroundColor: card.bg }}
            >
              <div className="flex items-center gap-2">
                <card.icon className={cn("h-4 w-4", card.color)} />
                <p className="text-xs text-white/40">{card.label}</p>
              </div>
              <p className={cn("mt-2 text-2xl font-bold", card.color)}>
                {card.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── HEALTH CIRCLE + QUICK STATS ── */}
        <div
          className="flex items-center gap-8 rounded-2xl border border-white/5 p-6"
          style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
        >
          <HealthCircle score={data?.healthScore ?? 0} />

          <div className="flex-1 space-y-3">
            <p className="text-sm font-semibold text-white">
              {(data?.healthScore ?? 0) >= 70
                ? "Your knowledge base is healthy"
                : (data?.healthScore ?? 0) >= 40
                ? "Your knowledge base needs attention"
                : "Your knowledge base is critically stale"}
            </p>
            <p className="text-xs leading-relaxed text-white/40">
              Health score combines average document freshness (60% weight) and
              open contradictions penalty (40% weight). Score above 70 is healthy,
              40-70 needs review, below 40 is critical.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <div className="rounded-lg border border-white/8 px-3 py-1.5">
                <p className="text-[10px] text-white/30">Avg freshness</p>
                <p className="text-sm font-semibold text-white">{data?.avgDecay ?? 0}%</p>
              </div>
              <div className="rounded-lg border border-white/8 px-3 py-1.5">
                <p className="text-[10px] text-white/30">Open contradictions</p>
                <p className={cn(
                  "text-sm font-semibold",
                  (data?.openContradictions ?? 0) > 0 ? "text-red-400" : "text-emerald-400"
                )}>
                  {data?.openContradictions ?? 0}
                </p>
              </div>
              <div className="rounded-lg border border-white/8 px-3 py-1.5">
                <p className="text-[10px] text-white/30">Total documents</p>
                <p className="text-sm font-semibold text-white">
                  {data?.documents.length ?? 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── CONTRADICTIONS ── */}
        {openContradictions.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <h2 className="text-sm font-semibold text-white">
                Open Contradictions
                <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] text-red-400">
                  {openContradictions.length}
                </span>
              </h2>
            </div>

            <div className="space-y-3">
              {openContradictions.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "overflow-hidden rounded-xl border",
                    SEVERITY_STYLES[c.severity]
                  )}
                >
                  {/* contradiction header */}
                  <div
                    className="flex cursor-pointer items-start justify-between p-4"
                    onClick={() =>
                      setExpandedContradiction(
                        expandedContradiction === c.id ? null : c.id
                      )
                    }
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn("border text-[10px]", SEVERITY_STYLES[c.severity])}
                        >
                          {c.severity}
                        </Badge>
                        <p className="text-xs font-medium text-white/80">
                          <span className="text-white/50">{c.sourceDocA}</span>
                          <span className="mx-1.5 text-white/20">↔</span>
                          <span className="text-white/50">{c.sourceDocB}</span>
                        </p>
                        <span className="text-[10px] text-white/20">
                          {Math.round(c.similarityScore * 100)}% similar
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-white/50 line-clamp-2">
                        {c.llmVerdict}
                      </p>
                    </div>
                    <div className="ml-3 flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-white/20">
                        {daysAgo(c.createdAt)}
                      </span>
                      {expandedContradiction === c.id
                        ? <ChevronUp className="h-4 w-4 text-white/20" />
                        : <ChevronDown className="h-4 w-4 text-white/20" />}
                    </div>
                  </div>

                  {/* expanded view */}
                  {expandedContradiction === c.id && (
                    <div className="border-t border-white/5 p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div
                          className="rounded-lg p-3 text-xs"
                          style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
                        >
                          <p className="mb-1.5 font-semibold text-white/40">
                            📄 {c.sourceDocA} (older)
                          </p>
                          <p className="leading-relaxed text-white/50 line-clamp-6">
                            {c.chunkTextA}
                          </p>
                        </div>
                        <div
                          className="rounded-lg p-3 text-xs"
                          style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
                        >
                          <p className="mb-1.5 font-semibold text-white/40">
                            📄 {c.sourceDocB} (newer)
                          </p>
                          <p className="leading-relaxed text-white/50 line-clamp-6">
                            {c.chunkTextB}
                          </p>
                        </div>
                      </div>

                      <div
                        className="rounded-lg border border-white/8 p-3 text-xs text-white/50"
                        style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
                      >
                        <p className="mb-1 font-semibold text-white/30">
                          AI Analysis
                        </p>
                        {c.llmVerdict}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateContradiction(c.id, "RESOLVED")}
                          disabled={updating === c.id}
                          className="gap-1.5 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                        >
                          {updating === c.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Check className="h-3 w-3" />}
                          Mark resolved
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateContradiction(c.id, "DISMISSED")}
                          disabled={updating === c.id}
                          className="gap-1.5 border-white/10 text-white/30 hover:border-white/20"
                        >
                          <X className="h-3 w-3" />
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── DOCUMENT DECAY TABLE ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-white/30" />
            <h2 className="text-sm font-semibold text-white">Document Freshness</h2>
          </div>

          {!data?.documents.length ? (
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-xl border border-white/5 py-12"
              style={{ backgroundColor: "rgba(255,255,255,0.02)" }}
            >
              <FileText className="h-8 w-8 text-white/10" />
              <p className="text-sm text-white/20">No documents in knowledge base yet</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-white/5">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Document", "Type", "Ingested", "Half-life", "Freshness", "Status"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-white/20"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.documents.map((doc, i) => (
                    <tr
                      key={`${doc.source}-${i}`}
                      className={cn(
                        "transition-colors hover:bg-white/[0.02]",
                        doc.is_stale && "bg-red-500/[0.03]"
                      )}
                    >
                      <td className="px-4 py-3">
                        <p className="max-w-[200px] truncate text-xs font-medium text-white/70">
                          {DOC_TYPE_ICONS[doc.doc_type] ?? "📄"} {doc.source}
                        </p>
                        <p className="text-[10px] text-white/20">
                          {doc.chunk_count} chunks
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/30">
                          {doc.doc_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-white/30">
                        {formatDate(doc.created_at)}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-white/30">
                        {doc.half_life}d
                      </td>
                      <td className="px-4 py-3">
                        <DecayBar score={doc.avg_decay} />
                      </td>
                      <td className="px-4 py-3">
                        {doc.is_stale ? (
                          <span className="flex items-center gap-1 text-[10px] text-red-400">
                            <AlertTriangle className="h-3 w-3" />
                            Stale
                          </span>
                        ) : doc.is_warning ? (
                          <span className="flex items-center gap-1 text-[10px] text-amber-400">
                            <Clock className="h-3 w-3" />
                            Review soon
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                            <CheckCircle className="h-3 w-3" />
                            Fresh
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── RESOLVED CONTRADICTIONS ── */}
        {resolvedContradictions.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-medium text-white/20">
              Resolved Contradictions ({resolvedContradictions.length})
            </h2>
            <div className="space-y-2">
              {resolvedContradictions.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-white/5 px-4 py-2.5 opacity-50"
                >
                  <p className="text-xs text-white/40 line-clamp-1">
                    {c.sourceDocA} ↔ {c.sourceDocB}
                  </p>
                  <Badge
                    variant="outline"
                    className="border-white/10 text-[10px] text-white/20"
                  >
                    {c.status}
                  </Badge>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* research attribution */}
        <div
          className="rounded-xl border border-white/5 p-4"
          style={{ backgroundColor: "rgba(255,255,255,0.01)" }}
        >
          <p className="text-[10px] leading-relaxed text-white/15">
            <span className="font-semibold text-white/25">echo-nemo-1.0 · Knowledge Decay Detection</span>
            {" "}— Temporal decay uses exponential half-life formula e^(−λt) where λ = ln(2)/half_life_days,
            per document type. Contradiction detection uses two-stage pipeline: cosine similarity
            threshold (≥0.75) followed by Groq Llama 3.3 70B semantic verification.
            Novel contribution: no existing RAG system combines temporal decay + LLM-verified
            contradiction detection in a unified knowledge health system.
          </p>
        </div>
      </div>
    </div>
  );
}
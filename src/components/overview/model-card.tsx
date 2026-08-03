"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  Brain,
  Zap,
  Database,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ModelStats {
  ragQueries: number;
  accuracyPercent: number | null;
  totalChunks: number;
  documentsIndexed: number;
  connectedAgents: number;
}

export function ModelCard() {
  const { user } = useUser();
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/overview/stats").then((r) => r.json()),
      fetch("/api/rag/documents").then((r) => r.json()),
      fetch("/api/agents/keys").then((r) => r.json()),
    ])
      .then(([overviewData, docsData, agentsData]) => {
        setStats({
          ragQueries: overviewData.ragQueries ?? 0,
          accuracyPercent: overviewData.ragAccuracy ?? null,
          totalChunks: docsData.total_chunks ?? 0,
          documentsIndexed: docsData.documents?.length ?? 0,
          connectedAgents: agentsData.keys?.length ?? 0,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const capabilities = [
    {
      label: "Document ingestion",
      detail: "PDF, DOCX, CSV, TXT, MD, URLs",
      active: true,
    },
    {
      label: "Adaptive retrieval",
      detail: "Learns from your feedback",
      active: (stats?.ragQueries ?? 0) > 0,
    },
    {
      label: "Video transcript RAG",
      detail: "Echo recordings auto-indexed",
      active: true,
    },
    {
      label: "Agent override",
      detail: "Claude / GPT-4 / Gemini",
      active: (stats?.connectedAgents ?? 0) > 0,
    },
  ];

  const accuracy = stats?.accuracyPercent ?? null;
  const accuracyColor =
    accuracy === null
      ? "text-white/20"
      : accuracy >= 80
      ? "text-emerald-400"
      : accuracy >= 60
      ? "text-amber-400"
      : "text-red-400";

  return (
    <div className="mt-10">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-white">
          echo-nemo-1.0
        </h2>
        <p className="mt-0.5 text-sm text-white/30">
          Your personal adaptive RAG model — gets smarter with every interaction
        </p>
      </div>

      <div
        className="overflow-hidden rounded-2xl border border-white/8"
        style={{
          background:
            "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(255,255,255,0.02) 100%)",
        }}
      >
        {/* top strip */}
        <div
          className="border-b border-white/5 px-6 py-4"
          style={{ backgroundColor: "rgba(139,92,246,0.06)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">
                    echo-nemo-1.0
                  </p>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: "rgba(52,211,153,0.15)",
                      color: "#34d399",
                    }}
                  >
                    Active
                  </span>
                </div>
                <p className="text-[11px] text-white/30">
                  Groq Llama 3.3 70B · Chroma RAG · sentence-transformers/all-MiniLM-L6-v2
                </p>
              </div>
            </div>

            {/* accuracy pill */}
            <div
              className="flex flex-col items-center rounded-xl px-4 py-2"
              style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              <p
                className={cn(
                  "text-2xl font-bold tabular-nums",
                  accuracyColor
                )}
              >
                {loading ? (
                  <span className="inline-block h-7 w-10 animate-pulse rounded bg-white/10" />
                ) : accuracy === null ? (
                  "—"
                ) : (
                  `${accuracy}%`
                )}
              </p>
              <p className="text-[10px] text-white/25">accuracy</p>
            </div>
          </div>
        </div>

        {/* stats grid */}
        <div className="grid grid-cols-2 divide-x divide-y divide-white/5 md:grid-cols-4 md:divide-y-0">
          {[
            {
              icon: Database,
              label: "Documents",
              value: loading ? null : stats?.documentsIndexed ?? 0,
              sub: "indexed",
            },
            {
              icon: Zap,
              label: "Chunks",
              value: loading ? null : stats?.totalChunks ?? 0,
              sub: "in knowledge base",
            },
            {
              icon: TrendingUp,
              label: "Queries",
              value: loading ? null : stats?.ragQueries ?? 0,
              sub: "total answered",
            },
            {
              icon: Brain,
              label: "Agents",
              value: loading ? null : stats?.connectedAgents ?? 0,
              sub: "connected",
            },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1 px-5 py-4">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-white/20">
                {stat.label}
              </p>
              <p className="text-2xl font-semibold tabular-nums text-white">
                {stat.value === null ? (
                  <span className="inline-block h-7 w-8 animate-pulse rounded bg-white/10" />
                ) : (
                  stat.value
                )}
              </p>
              <p className="text-[10px] text-white/20">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* accuracy bar */}
        {accuracy !== null && (
          <div className="border-t border-white/5 px-6 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] text-white/25">
                Learning progress (based on {stats?.ragQueries} queries)
              </p>
              <p className={cn("text-[10px] font-medium", accuracyColor)}>
                {accuracy}% accurate
              </p>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${accuracy}%`,
                  background:
                    accuracy >= 80
                      ? "linear-gradient(90deg, #10b981, #34d399)"
                      : accuracy >= 60
                      ? "linear-gradient(90deg, #d97706, #fbbf24)"
                      : "linear-gradient(90deg, #dc2626, #f87171)",
                }}
              />
            </div>
            <p className="mt-1.5 text-[10px] text-white/15">
              {accuracy < 60
                ? "Rate more answers to improve accuracy"
                : accuracy < 80
                ? "Good progress — keep rating answers to fine-tune"
                : "Excellent — your knowledge base is well calibrated"}
            </p>
          </div>
        )}

        {/* capabilities */}
        <div className="border-t border-white/5 px-6 py-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/20">
            Capabilities
          </p>
          <div className="grid grid-cols-2 gap-2">
            {capabilities.map((cap) => (
              <div key={cap.label} className="flex items-start gap-2">
                {cap.active ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                ) : (
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/15" />
                )}
                <div>
                  <p
                    className={cn(
                      "text-xs font-medium",
                      cap.active ? "text-white/70" : "text-white/25"
                    )}
                  >
                    {cap.label}
                  </p>
                  <p className="text-[10px] text-white/20">{cap.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-3 border-t border-white/5 px-6 py-4">
          <Link
            href="/chat"
            className="flex items-center gap-1.5 rounded-lg bg-primary/15 px-4 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/25"
          >
            <Brain className="h-3.5 w-3.5" />
            Open echo-nemo-1.0
            <ArrowRight className="h-3 w-3" />
          </Link>
          <Link
            href="/agents"
            className="flex items-center gap-1.5 rounded-lg border border-white/8 px-4 py-2 text-xs font-medium text-white/40 transition-colors hover:border-white/15 hover:text-white/70"
          >
            <Zap className="h-3.5 w-3.5" />
            Connect agents
          </Link>
        </div>
      </div>
    </div>
  );
}
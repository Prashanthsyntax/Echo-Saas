"use client";

import { useEffect, useState } from "react";
import { TrendingUp, ThumbsUp, ThumbsDown, Brain, BarChart3 } from "lucide-react";

interface RagStats {
  total: number;
  thumbsUp: number;
  thumbsDown: number;
  avgRating: number;
  accuracyPercent: number | null;
}

interface TopSource {
  sourceDoc: string;
  score: number;
  usageCount: number;
}

export function RagAnalytics() {
  const [stats, setStats] = useState<RagStats | null>(null);
  const [topSources, setTopSources] = useState<TopSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/rag/feedback")
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats);
        setTopSources(data.topSources ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!stats || stats.total === 0) return null;

  return (
    <div
      className="mt-4 rounded-xl border border-white/5 p-4 space-y-4"
      style={{ backgroundColor: "rgba(139,92,246,0.04)" }}
    >
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-primary" />
        <p className="text-xs font-semibold text-white/60">
          echo-nemo-1.0 learning progress
        </p>
      </div>

      {/* accuracy meter */}
      {stats.accuracyPercent !== null && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-white/30">Answer accuracy</p>
            <p className="text-[10px] font-semibold text-white/60">
              {stats.accuracyPercent}%
            </p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${stats.accuracyPercent}%`,
                backgroundColor:
                  stats.accuracyPercent >= 80
                    ? "#34d399"
                    : stats.accuracyPercent >= 60
                    ? "#fbbf24"
                    : "#f87171",
              }}
            />
          </div>
        </div>
      )}

      {/* stats row */}
      <div className="grid grid-cols-3 gap-2">
        <div
          className="rounded-lg p-2.5 text-center"
          style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
        >
          <p className="text-lg font-semibold text-white">{stats.total}</p>
          <p className="text-[10px] text-white/25">queries</p>
        </div>
        <div
          className="rounded-lg p-2.5 text-center"
          style={{ backgroundColor: "rgba(52,211,153,0.08)" }}
        >
          <p className="text-lg font-semibold text-emerald-400">
            {stats.thumbsUp}
          </p>
          <p className="text-[10px] text-white/25">good</p>
        </div>
        <div
          className="rounded-lg p-2.5 text-center"
          style={{ backgroundColor: "rgba(239,68,68,0.06)" }}
        >
          <p className="text-lg font-semibold text-red-400">
            {stats.thumbsDown}
          </p>
          <p className="text-[10px] text-white/25">improved</p>
        </div>
      </div>

      {/* top sources */}
      {topSources.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-white/25 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Most reliable sources
          </p>
          {topSources.slice(0, 3).map((src) => (
            <div
              key={src.sourceDoc}
              className="flex items-center justify-between"
            >
              <p className="truncate text-[11px] text-white/40 max-w-[140px]">
                {src.sourceDoc.length > 25
                  ? src.sourceDoc.slice(0, 22) + "..."
                  : src.sourceDoc}
              </p>
              <div className="flex items-center gap-1.5">
                <div className="h-1 w-16 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-primary/40"
                    style={{
                      width: `${Math.min((src.score / 5) * 100, 100)}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-white/20">
                  {src.usageCount}x
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-white/15">
        Feedback improves future retrieval for your knowledge base only
      </p>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";

interface Stats {
  videos: number;
  comments: number;
  workspaces: number;
  views: number;
  transcripts: number;
  folders: number;
}

const statConfig = [
  { key: "videos", label: "RECORDINGS" },
  { key: "views", label: "TOTAL VIEWS" },
  { key: "comments", label: "COMMENTS" },
  { key: "transcripts", label: "AI TRANSCRIPTS" },
  { key: "folders", label: "FOLDERS" },
  { key: "workspaces", label: "WORKSPACES" },
] as const;

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    let start = 0;
    const duration = 800;
    const step = value / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  return <span>{display}</span>;
}

export function StatsRow() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/overview/stats")
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="mb-8 grid grid-cols-2 overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] md:grid-cols-3 lg:grid-cols-6">
      {statConfig.map((stat, i) => (
        <div
          key={stat.key}
          className="flex flex-col gap-2 border-r border-white/5 p-5 last:border-r-0"
        >
          <p className="text-[10px] font-medium tracking-widest text-white/30">
            {stat.label}
          </p>
          <p className="text-2xl font-semibold text-white">
            {loading ? (
              <span className="inline-block h-6 w-8 animate-pulse rounded bg-white/10" />
            ) : (
              <AnimatedNumber value={stats?.[stat.key] ?? 0} />
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
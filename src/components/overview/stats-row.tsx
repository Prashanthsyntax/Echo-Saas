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
  { key: "videos" as const, label: "RECORDINGS" },
  { key: "views" as const, label: "TOTAL VIEWS" },
  { key: "comments" as const, label: "COMMENTS" },
  { key: "transcripts" as const, label: "AI TRANSCRIPTS" },
  { key: "folders" as const, label: "FOLDERS" },
  { key: "workspaces" as const, label: "WORKSPACES" },
];

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    const duration = 600;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);

  return <>{display}</>;
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
    <div className="mb-8 overflow-hidden rounded-xl border border-white/5 bg-white/[0.02]">
      <div className="grid grid-cols-2 divide-x divide-y divide-white/5 md:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
        {statConfig.map((stat) => (
          <div key={stat.key} className="flex flex-col gap-1.5 px-5 py-4">
            <p className="text-[9px] font-semibold tracking-[0.15em] text-white/25">
              {stat.label}
            </p>
            <p className="text-2xl font-semibold tabular-nums text-white">
              {loading ? (
                <span className="inline-block h-7 w-6 animate-pulse rounded bg-white/8" />
              ) : (
                <AnimatedNumber value={stats?.[stat.key] ?? 0} />
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface ActionCard {
  title: string;
  description: string;
  href: string;
  label: string;
  emoji: string;
  gradient: string;
  comingSoon?: boolean;
}

const cards: ActionCard[] = [
  {
    title: "Record Video",
    description: "Capture your screen or webcam instantly",
    href: "/record",
    label: "Start recording",
    emoji: "🎥",
    gradient: "from-violet-500/20 to-purple-600/10",
  },
  {
    title: "Canvas",
    description: "Design workflows and diagrams visually",
    href: "/canvas",
    label: "Open canvas",
    emoji: "🎨",
    gradient: "from-blue-500/20 to-cyan-600/10",
  },
  {
    title: "Workflows",
    description: "Build automation flows with drag and drop",
    href: "/workflows",
    label: "Build workflow",
    emoji: "⚡",
    gradient: "from-amber-500/20 to-orange-600/10",
  },
  {
    title: "Knowledge Graph",
    description: "Upload a PDF and extract visual knowledge",
    href: "/knowledge",
    label: "Upload document",
    emoji: "🧠",
    gradient: "from-emerald-500/20 to-teal-600/10",
  },
  {
    title: "Chat",
    description: "Ask questions about your knowledge graph",
    href: "/chat",
    label: "Open chat",
    emoji: "💬",
    gradient: "from-pink-500/20 to-rose-600/10",
  },
  {
    title: "Video Library",
    description: "Browse and manage all your recordings",
    href: "/dashboard",
    label: "View library",
    emoji: "📚",
    gradient: "from-indigo-500/20 to-blue-600/10",
  },
  {
    title: "Billing",
    description: "Upgrade to Pro for unlimited recordings",
    href: "/billing",
    label: "View plans",
    emoji: "💳",
    gradient: "from-slate-500/20 to-zinc-600/10",
  },
  {
    title: "Settings",
    description: "Manage your profile and workspace",
    href: "/settings",
    label: "Open settings",
    emoji: "⚙️",
    gradient: "from-gray-500/20 to-neutral-600/10",
  },
];

export function ActionCards() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Get started</h2>
        <p className="mt-0.5 text-sm text-white/40">
          Everything you need to build your async video workflow
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.04]"
          >
            {/* gradient background on hover */}
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-300 group-hover:opacity-100",
                card.gradient
              )}
            />

            {/* emoji icon */}
            <div className="relative mb-auto">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-3xl transition-transform duration-200 group-hover:scale-110">
                {card.emoji}
              </div>
            </div>

            {/* content */}
            <div className="relative mt-12">
              <p className="text-sm font-semibold text-white">{card.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/40">
                {card.description}
              </p>
            </div>

            {/* action label */}
            <div className="relative mt-4">
              <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 transition-colors group-hover:border-white/20 group-hover:text-white/80">
                {card.label}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
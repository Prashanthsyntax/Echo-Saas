"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Video,
  PenTool,
  Workflow,
  Network,
  MessageSquare,
  LayoutGrid,
  CreditCard,
  Settings,
} from "lucide-react";

interface ActionCard {
  title: string;
  description: string;
  href: string;
  label: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  accentColor: string;
}

const cards: ActionCard[] = [
  {
    title: "Record Video",
    description: "Capture your screen or webcam instantly",
    href: "/record",
    label: "Start recording",
    icon: Video,
    iconBg: "bg-violet-500/20",
    iconColor: "text-violet-400",
    accentColor: "hover:border-violet-500/20",
  },
  {
    title: "Canvas",
    description: "Design diagrams and workflows visually",
    href: "/canvas",
    label: "Open canvas",
    icon: PenTool,
    iconBg: "bg-cyan-500/20",
    iconColor: "text-cyan-400",
    accentColor: "hover:border-cyan-500/20",
  },
  {
    title: "Workflows",
    description: "Build automation flows with drag and drop",
    href: "/workflows",
    label: "Build workflow",
    icon: Workflow,
    iconBg: "bg-amber-500/20",
    iconColor: "text-amber-400",
    accentColor: "hover:border-amber-500/20",
  },
  {
    title: "Knowledge Graph",
    description: "Upload a PDF and extract visual knowledge",
    href: "/knowledge",
    label: "Upload document",
    icon: Network,
    iconBg: "bg-emerald-500/20",
    iconColor: "text-emerald-400",
    accentColor: "hover:border-emerald-500/20",
  },
  {
    title: "Chat",
    description: "Ask questions about your knowledge graph",
    href: "/chat",
    label: "Open chat",
    icon: MessageSquare,
    iconBg: "bg-pink-500/20",
    iconColor: "text-pink-400",
    accentColor: "hover:border-pink-500/20",
  },
  {
    title: "Video Library",
    description: "Browse and manage all your recordings",
    href: "/dashboard",
    label: "View library",
    icon: LayoutGrid,
    iconBg: "bg-indigo-500/20",
    iconColor: "text-indigo-400",
    accentColor: "hover:border-indigo-500/20",
  },
  {
    title: "Billing",
    description: "Upgrade to Pro for unlimited recordings",
    href: "/billing",
    label: "View plans",
    icon: CreditCard,
    iconBg: "bg-slate-500/20",
    iconColor: "text-slate-400",
    accentColor: "hover:border-slate-500/20",
  },
  {
    title: "Settings",
    description: "Manage your profile and workspace",
    href: "/settings",
    label: "Open settings",
    icon: Settings,
    iconBg: "bg-zinc-500/20",
    iconColor: "text-zinc-400",
    accentColor: "hover:border-zinc-500/20",
  },
];

export function ActionCards() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white">Get started</h2>
        <p className="mt-0.5 text-sm text-white/40">
          Everything you need to build your async video workflow
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className={cn(
              "group flex flex-col gap-4 rounded-2xl border border-white/5 bg-white/[0.02] p-5",
              "transition-all duration-200 hover:bg-white/[0.04]",
              card.accentColor
            )}
          >
            {/* icon */}
            <div
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110",
                card.iconBg
              )}
            >
              <card.icon className={cn("h-5 w-5", card.iconColor)} />
            </div>

            {/* text */}
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{card.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/40">
                {card.description}
              </p>
            </div>

            {/* action label */}
            <span className="inline-flex w-fit items-center rounded-lg border border-white/8 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/50 transition-colors group-hover:border-white/15 group-hover:text-white/70">
              {card.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
"use client";

import { usePresence, type OnlineUser } from "@/hooks/use-presence";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { useState } from "react";

const PAGE_LABELS: Record<string, string> = {
  "/overview": "Overview",
  "/dashboard": "Library",
  "/record": "Recording",
  "/canvas": "Canvas",
  "/workflows": "Workflows",
  "/knowledge": "Knowledge",
  "/chat": "Chat",
  "/agents": "Agents",
  "/settings": "Settings",
  "/billing": "Billing",
};

function getPageLabel(page: string): string {
  // match exact or prefix
  const exact = PAGE_LABELS[page];
  if (exact) return exact;
  const prefix = Object.entries(PAGE_LABELS).find(([key]) =>
    page.startsWith(key) && key !== "/"
  );
  return prefix ? prefix[1] : page;
}

function UserTooltip({ user, show }: { user: OnlineUser; show: boolean }) {
  if (!show) return null;
  return (
    <div
      className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 px-2.5 py-1.5 text-xs shadow-xl"
      style={{ backgroundColor: "#111114", zIndex: 9999 }}
    >
      <p className="font-medium text-white">{user.name}</p>
      <p className="text-white/40">{getPageLabel(user.page)}</p>
      <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-white/10 bg-[#111114]" />
    </div>
  );
}

export function PresenceAvatars() {
  const { onlineUsers, connected } = usePresence();
  const { user: currentUser } = useUser();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // filter out the current user — they know they're here
  const others = onlineUsers.filter(
    (u) => u.email !== currentUser?.primaryEmailAddress?.emailAddress
  );

  if (others.length === 0 && !connected) return null;

  const visible = others.slice(0, 5);
  const overflow = others.length - 5;

  return (
    <div className="flex items-center gap-2">
      {/* connection indicator */}
      {connected && others.length > 0 && (
        <p className="text-[10px] text-white/20">
          {others.length} online
        </p>
      )}

      {/* avatar stack */}
      <div className="flex items-center">
        {visible.map((user, i) => (
          <div
            key={user.userId}
            className="relative"
            style={{
              marginLeft: i === 0 ? 0 : -8,
              zIndex: visible.length - i,
            }}
            onMouseEnter={() => setHoveredId(user.userId)}
            onMouseLeave={() => setHoveredId(null)}
          >
            <UserTooltip user={user} show={hoveredId === user.userId} />
            <Avatar
              className="h-7 w-7 ring-2 ring-[#0a0a0a] transition-transform hover:scale-110 hover:z-50"
            >
              <AvatarImage src={user.imageUrl ?? ""} />
              <AvatarFallback
                className="text-[10px] font-semibold"
                style={{ backgroundColor: stringToColor(user.name) }}
              >
                {user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>

            {/* green dot — online indicator */}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-[#0a0a0a]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
          </div>
        ))}

        {/* overflow badge */}
        {overflow > 0 && (
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-[10px] font-medium text-white/50"
            style={{
              marginLeft: -8,
              backgroundColor: "#1a1a1e",
              zIndex: 0,
            }}
          >
            +{overflow}
          </div>
        )}
      </div>

      {/* same page indicator */}
      {others.some((u) => u.page === window?.location?.pathname) && (
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
          here now
        </span>
      )}
    </div>
  );
}

// deterministic color from a string — same name always gets same color
function stringToColor(str: string): string {
  const colors = [
    "#7c3aed", "#0891b2", "#059669",
    "#d97706", "#db2777", "#4338ca",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
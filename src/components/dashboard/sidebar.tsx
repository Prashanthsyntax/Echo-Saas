"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { UserProfileModal } from "./user-profile-modal";
import { WorkspaceManager } from "./workspace-manager";
import { useState } from "react";
import {
  LayoutDashboard,
  LayoutGrid,
  Video,
  PenTool,
  Workflow,
  Network,
  MessageSquare,
  Bot,
  Settings,
  CreditCard,
  Plus,
} from "lucide-react";
import { Role } from "@prisma/client";

const navItems = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard", label: "Library", icon: LayoutGrid },
  { href: "/record", label: "Record", icon: Video },
  { href: "/canvas", label: "Canvas", icon: PenTool },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/knowledge", label: "Knowledge", icon: Network },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const [showProfile, setShowProfile] = useState(false);
  const [managingWorkspace, setManagingWorkspace] = useState<{
    id: string;
    name: string;
    role: Role;
  } | null>(null);

  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    "Account";

  const initials = name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-white/5 bg-black/60 backdrop-blur-sm">
        {/* logo */}
        <div className="flex items-center gap-2 px-5 py-5">
          <Link href="/overview">
            <h1 className="text-2xl font-black tracking-tight">
              <span className="text-white">E</span>
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                cho
              </span>
            </h1>
          </Link>
        </div>

        {/* workspace switcher */}
        <WorkspaceSwitcher
          onManage={(id, name, role) =>
            setManagingWorkspace({ id, name, role })
          }
        />

        {/* new recording */}
        <div className="px-3">
          <Link
            href="/record"
            className="flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-100"
          >
            <Plus className="h-4 w-4" />
            New recording
          </Link>
        </div>

        {/* nav */}
        <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/overview" &&
                item.href !== "/" &&
                pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:bg-white/5 hover:text-white/70",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* user profile */}
        <div className="border-t border-white/5 p-3">
          <button
            onClick={() => setShowProfile(true)}
            className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-white/5"
          >
            <Avatar className="h-8 w-8 shrink-0 ring-1 ring-white/10">
              <AvatarImage src={user?.imageUrl} />
              <AvatarFallback className="bg-primary/20 text-xs font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">{name}</p>
              <p className="truncate text-[11px] text-white/30">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
            <div className="flex h-4 w-4 shrink-0 flex-col items-center justify-center gap-0.5">
              <span className="h-px w-3 bg-white/20" />
              <span className="h-px w-3 bg-white/20" />
            </div>
          </button>
        </div>
      </aside>

      {/* user profile modal */}
      {showProfile && (
        <UserProfileModal onClose={() => setShowProfile(false)} />
      )}

      {/* workspace manager modal */}
      {managingWorkspace && (
        <WorkspaceManager
          workspaceId={managingWorkspace.id}
          workspaceName={managingWorkspace.name}
          currentUserRole={managingWorkspace.role}
          onClose={() => setManagingWorkspace(null)}
        />
      )}
    </>
  );
}

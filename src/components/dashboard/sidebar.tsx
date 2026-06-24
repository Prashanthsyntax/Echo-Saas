"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  Video,
  PenTool,
  Workflow,
  Settings,
  CreditCard,
  Plus,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Library", icon: LayoutGrid },
  { href: "/record", label: "Record", icon: Video },
  { href: "/canvas", label: "Canvas", icon: PenTool },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card/30">
      {/* logo */}
      <div className="flex items-center gap-2 px-5 py-5">
        <Link href="/" className="flex items-center gap-2">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            <span className="text-white">E</span>
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              cho
            </span>
          </h1>
        </Link>
      </div>

      {/* primary action */}
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
      <nav className="mt-6 flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* user account */}
      <div className="flex items-center gap-3 border-t border-border px-5 py-4">
        <UserButton />
        <span className="text-xs text-muted-foreground">Account</span>
      </div>
    </aside>
  );
}

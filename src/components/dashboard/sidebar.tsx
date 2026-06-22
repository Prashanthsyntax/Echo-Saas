"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import {
  LayoutGrid,
  Video,
  Settings,
  CreditCard,
  Plus,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Library", icon: LayoutGrid },
  { href: "/record", label: "Record", icon: Video },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card/30">
      {/* logo */}
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
          E
        </div>
        <span className="text-sm font-semibold tracking-tight">Echo</span>
      </div>

      {/* primary action */}
      <div className="px-3">
        <Link
          href="/record"
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
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
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
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
        <UserButton afterSignOutUrl="/" />
        <span className="text-xs text-muted-foreground">Account</span>
      </div>
    </aside>
  );
}
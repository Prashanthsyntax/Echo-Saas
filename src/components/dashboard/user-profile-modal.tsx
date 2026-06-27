/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/purity */
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useUser, useClerk } from "@clerk/nextjs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  X,
  LogOut,
  Settings,
  CreditCard,
  Copy,
  Check,
} from "lucide-react";
import Link from "next/link";

interface UserProfileModalProps {
  onClose: () => void;
}

export function UserProfileModal({ onClose }: UserProfileModalProps) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [copied, setCopied] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut({ redirectUrl: "/" });
  };

  const handleCopyEmail = () => {
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) return null;

  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.username ||
    "User";
  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const modalContent = (
    <div
      className="fixed inset-0"
      style={{ zIndex: 9999 }}
    >
      {/* solid dark backdrop */}
      <div
        className="absolute inset-0 bg-black/80"
        onClick={onClose}
      />

      {/* modal — bottom-left, above sidebar */}
      <div
        className="absolute bottom-4 left-4 w-72 overflow-hidden rounded-2xl border border-white/20"
        style={{
          backgroundColor: "#111114",
          boxShadow: "0 25px 60px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.06)",
          zIndex: 10000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start justify-between p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 ring-2 ring-white/10">
              <AvatarImage src={user.imageUrl} />
              <AvatarFallback className="bg-primary/20 text-sm font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate max-w-[160px]">
                {name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-xs text-white/40 truncate max-w-[130px]">
                  {email}
                </p>
                <button
                  onClick={handleCopyEmail}
                  className="shrink-0 text-white/20 transition-colors hover:text-white/60"
                  title="Copy email"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* X close button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="shrink-0 rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <Separator className="bg-white/8" />

        {/* account info */}
        <div className="px-4 py-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/20 px-1">
            Account
          </p>
          <div
            className="flex items-center justify-between rounded-lg px-3 py-2"
            style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
          >
            <span className="text-xs text-white/40">Plan</span>
            <Badge
              className="text-[10px] border-0"
              style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
            >
              Free
            </Badge>
          </div>
          <div
            className="flex items-center justify-between rounded-lg px-3 py-2"
            style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
          >
            <span className="text-xs text-white/40">Member since</span>
            <span className="text-xs text-white/50">
              {new Date(user.createdAt ?? Date.now()).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        <Separator className="bg-white/8" />

        {/* navigation links */}
        <div className="p-2 space-y-0.5">
          <Link
            href="/settings"
            onClick={onClose}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-white/50 transition-colors hover:bg-white/8 hover:text-white"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <Link
            href="/billing"
            onClick={onClose}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-white/50 transition-colors hover:bg-white/8 hover:text-white"
          >
            <CreditCard className="h-4 w-4" />
            Billing &amp; Plans
          </Link>
        </div>

        <Separator className="bg-white/8" />

        {/* sign out */}
        <div className="p-2">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
}
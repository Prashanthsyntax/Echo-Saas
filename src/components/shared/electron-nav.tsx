"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ElectronNav() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined" || !window.electron) return;

    const cleanup = window.electron.onNavigate((path) => {
      router.push(path);
    });

    return cleanup;
  }, [router]);

  return null;
}
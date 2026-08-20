"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { usePathname } from "next/navigation";

export interface OnlineUser {
  userId: string;
  name: string;
  email: string;
  imageUrl: string | null;
  page: string;
  lastSeen: string;
}

const HEARTBEAT_INTERVAL = 30 * 1000; // 30 seconds

export function usePresence() {
  const { workspaceId } = useWorkspace();
  const pathname = usePathname();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentPageRef = useRef(pathname);

  useEffect(() => {
    currentPageRef.current = pathname;
  }, [pathname]);

  // send heartbeat — tells server we're here and on this page
  const sendHeartbeat = useCallback(async () => {
    if (!workspaceId) return;
    try {
      await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          page: currentPageRef.current,
        }),
      });
    } catch {
      // non-fatal
    }
  }, [workspaceId]);

  // send presence DELETE when user leaves
  const sendLeave = useCallback(() => {
    if (!workspaceId) return;
    // use sendBeacon for reliability on tab close
    const data = JSON.stringify({ workspaceId });
    if (navigator.sendBeacon) {
      const blob = new Blob([data], { type: "application/json" });
      navigator.sendBeacon("/api/presence", blob);
    } else {
      fetch("/api/presence", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: data,
        keepalive: true,
      }).catch(() => {});
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;

    // cleanup previous connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }

    // 1. send initial heartbeat immediately
    sendHeartbeat();

    // 2. open SSE connection
    const url = `/api/presence?workspaceId=${workspaceId}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "presence") {
          setOnlineUsers(data.users);
        }
      } catch {}
    };

    es.onerror = () => {
      setConnected(false);
      // SSE auto-reconnects — no manual handling needed
    };

    // 3. heartbeat every 30s
    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // 4. re-send heartbeat when page changes within workspace
    // (handles navigating from /canvas to /chat etc.)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 5. remove presence on tab close
    window.addEventListener("beforeunload", sendLeave);

    return () => {
      es.close();
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", sendLeave);
      sendLeave();
      setConnected(false);
    };
  }, [workspaceId, sendHeartbeat, sendLeave]);

  // re-send heartbeat on pathname change
  useEffect(() => {
    if (workspaceId) sendHeartbeat();
  }, [pathname, workspaceId, sendHeartbeat]);

  return { onlineUsers, connected };
}
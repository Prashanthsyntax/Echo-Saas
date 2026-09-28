/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import { getPusherClient } from "@/lib/pusher";

export interface AuditGapAlert {
  totalGaps:     number;
  criticalGaps:  number;
  recurringGaps: number;
  topGap: {
    controlId:       string;
    controlTitle:    string;
    finding:         string;
    severity:        string;
    filePath:        string;
    isRecurring:     boolean;
    previousFinding: string | null;
  };
  scanId: string;
}

export function useAuditAlerts(workspaceId: string | null) {
  const [alerts,     setAlerts    ] = useState<AuditGapAlert[]>([]);
  const [latestAlert,setLatestAlert] = useState<AuditGapAlert | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!workspaceId) return;
    const pusher  = getPusherClient();
    const channel = pusher.subscribe(`workspace-${workspaceId}`);
    channelRef.current = channel;

    channel.bind("audit-gap-detected", (data: AuditGapAlert) => {
      setAlerts(prev => [data, ...prev]);
      setLatestAlert(data);
    });

    return () => {
      channel.unbind("audit-gap-detected");
      pusher.unsubscribe(`workspace-${workspaceId}`);
    };
  }, [workspaceId]);

  const dismissAlert = () => setLatestAlert(null);

  return { alerts, latestAlert, dismissAlert };
}
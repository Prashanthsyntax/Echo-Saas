"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWorkspace } from "@/lib/workspace-context";

export interface PersistedMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: string[];
  modelUsed?: string | null;
  contextUsed: boolean;
  chunkIds: string[];
  feedback?: number | null;
  createdAt?: Date;
}

export function useChatPersistence() {
  const { workspaceId } = useWorkspace();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<PersistedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveQueueRef = useRef<Array<() => Promise<void>>>([]);
  const processingRef = useRef(false);

  // load session + messages on mount or workspace switch
  useEffect(() => {
    if (!workspaceId) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setMessages([]);
    setSessionId(null);

    fetch(`/api/chat/session?workspaceId=${workspaceId}`)
      .then((r) => r.json())
      .then(async (data) => {
        if (data.session) {
          setSessionId(data.session.id);
          setMessages(data.messages ?? []);
        } else {
          // create new session for this workspace
          const res = await fetch("/api/chat/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workspaceId }),
          });
          const created = await res.json();
          setSessionId(created.sessionId);
          setMessages([]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [workspaceId]);

  // process save queue sequentially
  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setSaving(true);

    while (saveQueueRef.current.length > 0) {
      const task = saveQueueRef.current.shift();
      if (task) {
        try {
          await task();
        } catch (err) {
          console.error("Save failed:", err);
        }
      }
    }

    processingRef.current = false;
    setSaving(false);
  }, []);

  // save a user message to DB and get back its ID
  const saveUserMessage = useCallback(
    async (content: string): Promise<string | null> => {
      if (!sessionId) return null;

      return new Promise((resolve) => {
        saveQueueRef.current.push(async () => {
          const res = await fetch("/api/chat/session/message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              role: "user",
              content,
            }),
          });
          const data = await res.json();
          resolve(data.messageId ?? null);
        });
        processQueue();
      });
    },
    [sessionId, processQueue]
  );

  // save an assistant message to DB and get back its ID
  const saveAssistantMessage = useCallback(
    async (
      content: string,
      meta: {
        sources?: string[];
        modelUsed?: string;
        contextUsed?: boolean;
        chunkIds?: string[];
      }
    ): Promise<string | null> => {
      if (!sessionId) return null;

      return new Promise((resolve) => {
        saveQueueRef.current.push(async () => {
          const res = await fetch("/api/chat/session/message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              role: "assistant",
              content,
              sources: meta.sources ?? [],
              modelUsed: meta.modelUsed ?? null,
              contextUsed: meta.contextUsed ?? false,
              chunkIds: meta.chunkIds ?? [],
            }),
          });
          const data = await res.json();
          resolve(data.messageId ?? null);
        });
        processQueue();
      });
    },
    [sessionId, processQueue]
  );

  // update feedback on a persisted message
  const saveFeedback = useCallback(
    async (messageId: string, feedback: 1 | -1) => {
      saveQueueRef.current.push(async () => {
        await fetch("/api/chat/session/message", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId, feedback }),
        });
      });
      processQueue();
    },
    [processQueue]
  );

  // clear all messages for this workspace
  const clearSession = useCallback(async () => {
    if (!workspaceId) return;
    await fetch("/api/chat/session", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });
    setMessages([]);
  }, [workspaceId]);

  return {
    sessionId,
    messages,
    setMessages,
    loading,
    saving,
    saveUserMessage,
    saveAssistantMessage,
    saveFeedback,
    clearSession,
  };
}
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWorkspace } from "@/lib/workspace-context";

interface SavedCanvasState {
  id: string;
  canvasData: Record<string, unknown>;
  viewportX: number;
  viewportY: number;
  zoomLevel: number;
  objectCount: number;
  updatedAt: string;
}

export function useCanvasPersistence() {
  const { workspaceId } = useWorkspace();
  const [savedState, setSavedState] = useState<SavedCanvasState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  // load saved canvas state on mount or workspace switch
  useEffect(() => {
    if (!workspaceId) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setSavedState(null);

    fetch(`/api/canvas/state?workspaceId=${workspaceId}`)
      .then((r) => r.json())
      .then((data) => {
        setSavedState(data.state ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [workspaceId]);

  // debounced auto-save — called on every canvas change
  const saveCanvasState = useCallback(
    (
      canvasJSON: Record<string, unknown>,
      viewport: { x: number; y: number; zoom: number },
      objectCount: number
    ) => {
      if (!workspaceId) return;

      // skip if nothing actually changed
      const snapshot = JSON.stringify({ canvasJSON, viewport });
      if (snapshot === lastSavedRef.current) return;

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(async () => {
        lastSavedRef.current = snapshot;
        setSaving(true);

        try {
          await fetch("/api/canvas/state", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspaceId,
              canvasData: canvasJSON,
              viewportX: viewport.x,
              viewportY: viewport.y,
              zoomLevel: viewport.zoom,
              objectCount,
            }),
          });
        } catch (err) {
          console.error("Canvas save failed:", err);
        } finally {
          setSaving(false);
        }
      }, 500); // 500ms debounce
    },
    [workspaceId]
  );

  // clear canvas state for this workspace
  const clearCanvasState = useCallback(async () => {
    if (!workspaceId) return;

    await fetch("/api/canvas/state", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId }),
    });

    setSavedState(null);
    lastSavedRef.current = "";
  }, [workspaceId]);

  return {
    savedState,
    loading,
    saving,
    saveCanvasState,
    clearCanvasState,
  };
}
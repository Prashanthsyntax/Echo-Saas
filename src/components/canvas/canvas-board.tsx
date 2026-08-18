/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  useEffect, useRef, useState, useCallback,
} from "react";
import { CanvasToolbar, type CanvasTool } from "./canvas-toolbar";
import { PropertiesPanel } from "./properties-panel";
import { useCanvasPersistence } from "@/hooks/use-canvas-persistence";
import { useWorkspace } from "@/lib/workspace-context";
import { Loader2, Trash2 } from "lucide-react";

export function CanvasBoard() {
  const { workspaceId } = useWorkspace();

  // ── Fabric refs ───────────────────────────────────────────────────────────
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);
  const fabricRef      = useRef<any>(null);
  const isReadyRef     = useRef(false);        // true once Fabric is fully up
  const isRestoringRef = useRef(false);        // true while loadFromJSON runs
  const isPanningRef   = useRef(false);
  const lastPosRef     = useRef({ x: 0, y: 0 });
  const isDrawingRef   = useRef(false);
  const startPtRef     = useRef({ x: 0, y: 0 });
  const activeShpRef   = useRef<any>(null);

  // ── Tool / style state ────────────────────────────────────────────────────
  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [zoom,        setZoom      ] = useState(1);
  const [strokeColor, setStrokeColor] = useState("#F4F4F5");
  const [fillColor,   setFillColor  ] = useState("transparent");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [objectCount, setObjectCount] = useState(0);

  // keep mutable refs in sync so event handlers always see current values
  const toolRef    = useRef(activeTool);
  const strokeRef  = useRef(strokeColor);
  const fillRef    = useRef(fillColor);
  const swRef      = useRef(strokeWidth);
  useEffect(() => { toolRef.current   = activeTool;  }, [activeTool]);
  useEffect(() => { strokeRef.current = strokeColor; }, [strokeColor]);
  useEffect(() => { fillRef.current   = fillColor;   }, [fillColor]);
  useEffect(() => { swRef.current     = strokeWidth; }, [strokeWidth]);

  // role state for permissions
  const [userRole, setUserRole] = useState<string>("VIEWER");
  useEffect(() => {
    if (!workspaceId) return;
    fetch("/api/workspaces")
      .then(r => r.json())
      .then(d => {
        const ws = d.workspaces?.find((w: any) => w.workspace.id === workspaceId);
        if (ws) setUserRole(ws.role);
      })
      .catch(() => {});
  }, [workspaceId]);

  // ── Persistence ───────────────────────────────────────────────────────────
  const {
    savedState,
    loading,
    saving,
    saveCanvasState,
    clearCanvasState,
  } = useCanvasPersistence();

  const savedStateRef = useRef(savedState);
  useEffect(() => {
    savedStateRef.current = savedState;
  }, [savedState]);

  // ── Save helper ───────────────────────────────────────────────────────────
  const triggerSave = useCallback(() => {
    const cv = fabricRef.current;
    if (!cv || isRestoringRef.current || !isReadyRef.current) return;
    const json  = cv.toJSON();
    const vpt   = cv.viewportTransform;
    const z     = cv.getZoom();
    const count = cv.getObjects().length;
    setObjectCount(count);
    saveCanvasState(json, { x: vpt[4], y: vpt[5], zoom: z }, count);
  }, [saveCanvasState]);

  // ── Destroy Fabric instance ───────────────────────────────────────────────
  const destroyCanvas = useCallback(() => {
    const cv = fabricRef.current;
    if (cv) {
      try { cv.dispose(); } catch {}
      fabricRef.current = null;
    }
    isReadyRef.current = false;
    isRestoringRef.current = false;
    isPanningRef.current   = false;
    isDrawingRef.current   = false;
    activeShpRef.current   = null;
  }, []);

  // ── Build Fabric instance ─────────────────────────────────────────────────
  const buildCanvas = useCallback(async () => {
    const canvasEl   = canvasRef.current;
    const container  = containerRef.current;
    if (!canvasEl || !container) return;

    // clear stale Fabric internal flag so constructor doesn't throw
    if ((canvasEl as any).__fabric) delete (canvasEl as any).__fabric;

    const { Canvas, Rect, Ellipse, Line, IText, Group, PencilBrush } =
      await import("fabric");

    const cv = new Canvas(canvasEl, {
      width:              container.clientWidth,
      height:             container.clientHeight,
      backgroundColor:    "#0A0A0F",
      selection:          true,
      renderOnAddRemove:  true,
    });

    // stash constructor references for use in handlers
    cv._fc = { Rect, Ellipse, Line, IText, Group };

    // free-draw brush
    cv.freeDrawingBrush         = new PencilBrush(cv);
    cv.freeDrawingBrush.color   = "#F4F4F5";
    cv.freeDrawingBrush.width   = 2;

    fabricRef.current  = cv;
    isReadyRef.current = true;

    // ── restore saved state ───────────────────────────────────────────
    const initial = savedStateRef.current;
    if (initial?.canvasData) {
      isRestoringRef.current = true;
      try {
        await cv.loadFromJSON(initial.canvasData);
        const vpt = cv.viewportTransform;
        vpt[4] = initial.viewportX;
        vpt[5] = initial.viewportY;
        cv.setZoom(initial.zoomLevel);
        cv.requestRenderAll();
        setZoom(initial.zoomLevel);
        setObjectCount(initial.objectCount);
      } catch (err) {
        console.error("Failed to restore canvas:", err);
      }
      isRestoringRef.current = false;
    }

    // ── event wiring ──────────────────────────────────────────────────

    cv.on("mouse:down", (opt: any) => {
      const e = opt.e as MouseEvent;

      // pan mode: Alt held OR middle mouse button
      if (e.altKey || e.button === 1) {
        isPanningRef.current = true;
        lastPosRef.current = { x: e.clientX, y: e.clientY };
        cv.setCursor("grabbing");
        return;
      }

      const tool = toolRef.current;
      if (tool === "select" || tool === "draw") return;

      const { Rect, Ellipse, Line, IText, Group } = cv._fc;
      const pointer = cv.getScenePoint(e);
      startPtRef.current  = { x: pointer.x, y: pointer.y };
      isDrawingRef.current = true;

      const sc = strokeRef.current;
      const fc = fillRef.current;
      const sw = swRef.current;

      if (tool === "text") {
        const t = new IText("Click to edit", {
          left: pointer.x, top: pointer.y,
          fill: sc, fontSize: 18,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        });
        cv.add(t);
        cv.setActiveObject(t);
        t.enterEditing();
        setActiveTool("select");
        isDrawingRef.current = false;
        // save after editing finishes
        cv.once("text:editing:exited", triggerSave);
        return;
      }

      if (tool === "sticky") {
        const bg = new Rect({
          left: pointer.x, top: pointer.y,
          width: 180, height: 140,
          fill: "#FDE68A", rx: 8, ry: 8,
        });
        const lbl = new IText("Sticky note", {
          left: pointer.x + 12, top: pointer.y + 12,
          fill: "#1C1917", fontSize: 14,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          width: 156,
        });
        cv.add(bg, lbl);
        setActiveTool("select");
        isDrawingRef.current = false;
        triggerSave();
        return;
      }

      let shape: any = null;
      if (tool === "rect") {
        shape = new Rect({
          left: pointer.x, top: pointer.y,
          width: 0, height: 0,
          stroke: sc, fill: fc === "transparent" ? "" : fc,
          strokeWidth: sw, selectable: false,
        });
      } else if (tool === "circle") {
        shape = new Ellipse({
          left: pointer.x, top: pointer.y,
          rx: 0, ry: 0,
          stroke: sc, fill: fc === "transparent" ? "" : fc,
          strokeWidth: sw, selectable: false,
        });
      } else if (tool === "line") {
        shape = new Line(
          [pointer.x, pointer.y, pointer.x, pointer.y],
          { stroke: sc, strokeWidth: sw, selectable: false }
        );
      }

      if (shape) {
        cv.add(shape);
        activeShpRef.current = shape;
      }
    });

    cv.on("mouse:move", (opt: any) => {
      const e = opt.e as MouseEvent;

      if (isPanningRef.current) {
        const dx = e.clientX - lastPosRef.current.x;
        const dy = e.clientY - lastPosRef.current.y;
        const vpt = cv.viewportTransform;
        vpt[4] += dx;
        vpt[5] += dy;
        cv.requestRenderAll();
        lastPosRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      if (!isDrawingRef.current || !activeShpRef.current) return;

      const pointer = cv.getScenePoint(e);
      const shape   = activeShpRef.current;
      const sx = startPtRef.current.x;
      const sy = startPtRef.current.y;
      const tool = toolRef.current;

      if (tool === "rect") {
        shape.set({
          left:   Math.min(sx, pointer.x),
          top:    Math.min(sy, pointer.y),
          width:  Math.abs(pointer.x - sx),
          height: Math.abs(pointer.y - sy),
        });
      } else if (tool === "circle") {
        shape.set({
          left: Math.min(sx, pointer.x),
          top:  Math.min(sy, pointer.y),
          rx:   Math.abs(pointer.x - sx) / 2,
          ry:   Math.abs(pointer.y - sy) / 2,
        });
      } else if (tool === "line") {
        shape.set({ x2: pointer.x, y2: pointer.y });
      }
      cv.requestRenderAll();
    });

    cv.on("mouse:up", () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        cv.setCursor("default");
        triggerSave();
        return;
      }

      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;

      if (activeShpRef.current) {
        activeShpRef.current.set({ selectable: true });
        cv.setActiveObject(activeShpRef.current);
        activeShpRef.current = null;
      }

      setActiveTool("select");
      triggerSave();
    });

    cv.on("mouse:wheel", (opt: any) => {
      const delta = opt.e.deltaY;
      let z = cv.getZoom();
      z *= 0.999 ** delta;
      z = Math.max(0.1, Math.min(5, z));
      cv.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, z);
      setZoom(z);
      opt.e.preventDefault();
      opt.e.stopPropagation();
      triggerSave();
    });

    // save on any mutation
    cv.on("object:modified",  triggerSave);
    cv.on("object:removed",   triggerSave);
    cv.on("path:created",     triggerSave);
    // object:added fires during restore — guard inside triggerSave via isRestoringRef

    // resize observer
    const ro = new ResizeObserver(() => {
      if (!container || !cv) return;
      cv.setDimensions({
        width:  container.clientWidth,
        height: container.clientHeight,
      });
    });
    ro.observe(container);

    // store cleanup ref on the canvas object for teardown
    cv._ro = ro;
  }, [triggerSave]); // savedState removed from deps, uses savedStateRef

  // ── Real-time sync — poll for remote changes every 5s ────────────────────
  // When another workspace member saves the canvas, we reload it here.
  const lastSyncedAt = useRef<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    // FIX: reset the baseline whenever we switch workspaces, otherwise the
    // previous workspace's timestamp leaks in and the "first poll" branch
    // below never runs for the new workspace.
    lastSyncedAt.current = null;

    const interval = setInterval(async () => {
      // FIX: check readiness per-tick instead of gating the whole effect on
      // isReadyRef.current at setup time. buildCanvas() is async and runs in
      // a separate effect, so isReadyRef.current is reliably still false the
      // instant this effect fires — gating here meant the interval was never
      // created at all, and the poll silently never started.
      if (isRestoringRef.current || !isReadyRef.current || !fabricRef.current) return;

      try {
        const res  = await fetch(`/api/canvas/state?workspaceId=${workspaceId}`);
        if (!res.ok) return;
        const data = await res.json();
        const state = data.state;
        if (!state) return;

        // only reload if someone else updated it more recently
        if (state.updatedAt === lastSyncedAt.current) return;
        if (!lastSyncedAt.current) {
          // first sync — set baseline, don't overwrite our current session
          lastSyncedAt.current = state.updatedAt;
          return;
        }

        // another user changed the canvas — reload
        lastSyncedAt.current = state.updatedAt;
        const cv = fabricRef.current;
        if (!cv || !state.canvasData) return;

        isRestoringRef.current = true;
        try {
          await cv.loadFromJSON(state.canvasData);
          const vpt = cv.viewportTransform;
          vpt[4] = state.viewportX;
          vpt[5] = state.viewportY;
          cv.setZoom(state.zoomLevel);
          cv.requestRenderAll();
          setZoom(state.zoomLevel);
          setObjectCount(state.objectCount);
        } catch (err) {
          console.error("Failed to sync remote canvas:", err);
        }
        isRestoringRef.current = false;
      } catch {}
    }, 5000); // poll every 5 seconds

    return () => clearInterval(interval);
  }, [workspaceId]);

  // ── Main lifecycle — rebuild canvas when workspace changes ────────────────
  useEffect(() => {
    // wait until the persistence hook has finished loading
    if (loading) return;

    // tear down any existing instance first
    destroyCanvas();

    // reset object count display
    setObjectCount(0);
    setZoom(1);

    // build a fresh Fabric instance
    buildCanvas();

    return () => {
      const cv = fabricRef.current;
      if (cv?._ro) cv._ro.disconnect();
      destroyCanvas();
    };
  }, [workspaceId, loading, destroyCanvas, buildCanvas]);
  // ↑ workspaceId in deps — ensures full rebuild on workspace switch
  // savedState intentionally NOT here — buildCanvas reads it at call time

  // ── Tool mode sync ────────────────────────────────────────────────────────
  useEffect(() => {
    const cv = fabricRef.current;
    if (!cv || !isReadyRef.current) return;

    cv.isDrawingMode = activeTool === "draw";
    if (activeTool === "draw" && cv.freeDrawingBrush) {
      cv.freeDrawingBrush.color = strokeColor;
      cv.freeDrawingBrush.width = strokeWidth;
    }
    cv.selection = activeTool === "select";
    cv.forEachObject((obj: any) => {
      obj.selectable = activeTool === "select";
    });
  }, [activeTool, strokeColor, strokeWidth]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    const cv = fabricRef.current;
    if (!cv || !isReadyRef.current) return;
    cv.getActiveObjects().forEach((obj: any) => cv.remove(obj));
    cv.discardActiveObject();
    cv.requestRenderAll();
    triggerSave();
  }, [triggerSave]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const map: Record<string, CanvasTool> = {
        v: "select", d: "draw", r: "rect",
        c: "circle", l: "line", t: "text", s: "sticky",
      };
      if (map[e.key]) setActiveTool(map[e.key] as CanvasTool);
      if (e.key === "Delete" || e.key === "Backspace") handleDelete();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDelete]);

  // ── Toolbar actions ───────────────────────────────────────────────────────
  const handleExport = useCallback(() => {
    const cv = fabricRef.current;
    if (!cv) return;
    const url = cv.toDataURL({ format: "png", multiplier: 2 });
    const a   = document.createElement("a");
    a.href     = url;
    a.download = `canvas-${Date.now()}.png`;
    a.click();
  }, []);

  const handleZoomIn = useCallback(() => {
    const cv = fabricRef.current;
    if (!cv) return;
    const z = Math.min(5, cv.getZoom() * 1.2);
    cv.setZoom(z);
    setZoom(z);
    triggerSave();
  }, [triggerSave]);

  const handleZoomOut = useCallback(() => {
    const cv = fabricRef.current;
    if (!cv) return;
    const z = Math.max(0.1, cv.getZoom() / 1.2);
    cv.setZoom(z);
    setZoom(z);
    triggerSave();
  }, [triggerSave]);

  const handleResetView = useCallback(() => {
    const cv = fabricRef.current;
    if (!cv) return;
    cv.setViewportTransform([1, 0, 0, 1, 0, 0]);
    cv.setZoom(1);
    setZoom(1);
    triggerSave();
  }, [triggerSave]);

  const handleClearAll = useCallback(async () => {
    if (!confirm("Clear the entire canvas? This cannot be undone.")) return;
    const cv = fabricRef.current;
    if (!cv) return;
    cv.clear();
    cv.backgroundColor = "#0A0A0F";
    cv.requestRenderAll();
    setObjectCount(0);
    setZoom(1);
    cv.setViewportTransform([1, 0, 0, 1, 0, 0]);
    await clearCanvasState();
  }, [clearCanvasState]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-white/30">Restoring your canvas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-sm font-semibold">Canvas</h1>
          <div className="mt-0.5 flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              Alt + drag to pan · Scroll to zoom
            </p>
            {saving && (
              <span className="animate-pulse text-[10px] text-white/20">
                saving...
              </span>
            )}
            {!saving && objectCount > 0 && (
              <span className="text-[10px] text-white/20">
                {objectCount} object{objectCount !== 1 ? "s" : ""} · auto-saved
              </span>
            )}
          </div>
        </div>

        <CanvasToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onDelete={handleDelete}
          onExport={handleExport}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onReset={handleResetView}
          zoom={zoom}
        />

        {(userRole === "OWNER" || userRole === "ADMIN") && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1.5 rounded-lg border border-destructive/20 px-3 py-1.5 text-xs text-destructive/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear all
          </button>
        )}
      </div>

      {/* canvas area */}
      <div className="relative flex flex-1 overflow-hidden">
        <div ref={containerRef} className="flex-1 overflow-hidden">
          <canvas ref={canvasRef} />
        </div>

        {/* floating properties panel */}
        <div className="absolute left-4 top-4">
          <PropertiesPanel
            strokeColor={strokeColor}
            fillColor={fillColor}
            strokeWidth={strokeWidth}
            onStrokeColorChange={setStrokeColor}
            onFillColorChange={setFillColor}
            onStrokeWidthChange={setStrokeWidth}
          />
        </div>
      </div>
    </div>
  );
}
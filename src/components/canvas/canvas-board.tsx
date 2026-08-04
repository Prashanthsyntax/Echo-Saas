/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { CanvasToolbar, type CanvasTool } from "./canvas-toolbar";
import { PropertiesPanel } from "./properties-panel";
import { useCanvasPersistence } from "@/hooks/use-canvas-persistence";
import { Loader2, Trash2 } from "lucide-react";

export function CanvasBoard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initializingRef = useRef(false);
  const isRestoringRef = useRef(false);

  const [activeTool, setActiveTool] = useState<CanvasTool>("select");
  const [zoom, setZoom] = useState(1);
  const [strokeColor, setStrokeColor] = useState("#F4F4F5");
  const [fillColor, setFillColor] = useState("transparent");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [objectCount, setObjectCount] = useState(0);

  const activeToolRef = useRef(activeTool);
  const strokeColorRef = useRef(strokeColor);
  const fillColorRef = useRef(fillColor);
  const strokeWidthRef = useRef(strokeWidth);

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { strokeColorRef.current = strokeColor; }, [strokeColor]);
  useEffect(() => { fillColorRef.current = fillColor; }, [fillColor]);
  useEffect(() => { strokeWidthRef.current = strokeWidth; }, [strokeWidth]);

  const isDrawingShape = useRef(false);
  const startPoint = useRef({ x: 0, y: 0 });
  const activeShape = useRef<any>(null);

  const {
    savedState,
    loading,
    saving,
    saveCanvasState,
    clearCanvasState,
  } = useCanvasPersistence();

  // trigger save on any canvas change
  const triggerSave = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || isRestoringRef.current) return;

    const json = canvas.toJSON();
    const vpt = canvas.viewportTransform;
    const currentZoom = canvas.getZoom();
    const count = canvas.getObjects().length;

    setObjectCount(count);
    saveCanvasState(
      json,
      { x: vpt[4], y: vpt[5], zoom: currentZoom },
      count
    );
  }, [saveCanvasState]);

  // restore saved canvas state
  const restoreCanvasState = useCallback(
    async (canvas: any, fabricModule: any) => {
      if (!savedState?.canvasData) return;

      isRestoringRef.current = true;
      try {
        await new Promise<void>((resolve) => {
          canvas.loadFromJSON(savedState.canvasData, () => {
            canvas.requestRenderAll();

            // restore viewport transform
            const vpt = canvas.viewportTransform;
            vpt[4] = savedState.viewportX;
            vpt[5] = savedState.viewportY;
            canvas.setZoom(savedState.zoomLevel);
            canvas.requestRenderAll();

            setZoom(savedState.zoomLevel);
            setObjectCount(savedState.objectCount);
            resolve();
          });
        });
      } catch (err) {
        console.error("Failed to restore canvas:", err);
      } finally {
        isRestoringRef.current = false;
      }
    },
    [savedState]
  );

  const handleMouseDown = useCallback((opt: any, canvas: any) => {
    const tool = activeToolRef.current;
    if (tool === "select" || tool === "draw") return;

    const { Rect, Ellipse, Line, IText, Group } = canvas._fabricClasses;
    const pointer = canvas.getScenePoint(opt.e);
    startPoint.current = { x: pointer.x, y: pointer.y };
    isDrawingShape.current = true;

    const sc = strokeColorRef.current;
    const fc = fillColorRef.current;
    const sw = strokeWidthRef.current;
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
      shape = new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
        stroke: sc, strokeWidth: sw, selectable: false,
      });
    } else if (tool === "text") {
      const text = new IText("Click to edit", {
        left: pointer.x, top: pointer.y,
        fill: sc, fontSize: 18,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
      });
      canvas.add(text);
      canvas.setActiveObject(text);
      text.enterEditing();
      setActiveTool("select");
      isDrawingShape.current = false;
      triggerSave();
      return;
    } else if (tool === "sticky") {
      const bg = new Rect({
        width: 180, height: 140,
        fill: "#FDE68A", rx: 8, ry: 8,
      });
      const label = new IText("Sticky note", {
        left: 12, top: 12,
        fill: "#1C1917", fontSize: 14,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        width: 156,
      });
      const group = new Group([bg, label], {
        left: pointer.x, top: pointer.y,
      });
      canvas.add(group);
      setActiveTool("select");
      isDrawingShape.current = false;
      triggerSave();
      return;
    }

    if (shape) {
      canvas.add(shape);
      activeShape.current = shape;
    }
  }, [triggerSave]);

  const handleMouseMove = useCallback((opt: any, canvas: any) => {
    if (!isDrawingShape.current || !activeShape.current) return;
    const tool = activeToolRef.current;
    const pointer = canvas.getScenePoint(opt.e);
    const shape = activeShape.current;
    const sx = startPoint.current.x;
    const sy = startPoint.current.y;

    if (tool === "rect") {
      shape.set({
        left: Math.min(sx, pointer.x), top: Math.min(sy, pointer.y),
        width: Math.abs(pointer.x - sx), height: Math.abs(pointer.y - sy),
      });
    } else if (tool === "circle") {
      shape.set({
        left: Math.min(sx, pointer.x), top: Math.min(sy, pointer.y),
        rx: Math.abs(pointer.x - sx) / 2,
        ry: Math.abs(pointer.y - sy) / 2,
      });
    } else if (tool === "line") {
      shape.set({ x2: pointer.x, y2: pointer.y });
    }
    canvas.requestRenderAll();
  }, []);

  const handleMouseUp = useCallback((canvas: any) => {
    if (!isDrawingShape.current) return;
    isDrawingShape.current = false;
    if (activeShape.current) {
      activeShape.current.set({ selectable: true });
      canvas.setActiveObject(activeShape.current);
      activeShape.current = null;
    }
    setActiveTool("select");
    triggerSave();
  }, [triggerSave]);

  // initialize Fabric.js
  useEffect(() => {
    // wait for saved state to load before initializing
    if (loading) return;
    if (initializingRef.current) return;
    initializingRef.current = true;

    let canvas: any = null;
    let ro: ResizeObserver | null = null;

    import("fabric").then(async (fabricModule) => {
      const { Canvas, Rect, Ellipse, Line, IText, Group, PencilBrush } = fabricModule;
      const container = containerRef.current;
      const canvasEl = canvasRef.current;
      if (!container || !canvasEl) return;

      if ((canvasEl as any).__fabric) {
        delete (canvasEl as any).__fabric;
      }

      canvas = new Canvas(canvasEl, {
        width: container.clientWidth,
        height: container.clientHeight,
        backgroundColor: "#0A0A0F",
        selection: true,
        renderOnAddRemove: true,
      });

      canvas._fabricClasses = { Rect, Ellipse, Line, IText, Group };
      fabricRef.current = canvas;

      canvas.freeDrawingBrush = new PencilBrush(canvas);
      canvas.freeDrawingBrush.color = "#F4F4F5";
      canvas.freeDrawingBrush.width = 2;

      // restore saved state if available
      if (savedState?.canvasData) {
        await restoreCanvasState(canvas, fabricModule);
      }

      let isPanning = false;
      let lastPos = { x: 0, y: 0 };

      canvas.on("mouse:down", (opt: any) => {
        const e = opt.e as MouseEvent;
        if (e.altKey || e.button === 1) {
          isPanning = true;
          lastPos = { x: e.clientX, y: e.clientY };
          canvas.setCursor("grabbing");
          return;
        }
        handleMouseDown(opt, canvas);
      });

      canvas.on("mouse:move", (opt: any) => {
        const e = opt.e as MouseEvent;
        if (isPanning) {
          const dx = e.clientX - lastPos.x;
          const dy = e.clientY - lastPos.y;
          const vpt = canvas.viewportTransform;
          vpt[4] += dx;
          vpt[5] += dy;
          canvas.requestRenderAll();
          lastPos = { x: e.clientX, y: e.clientY };
          return;
        }
        handleMouseMove(opt, canvas);
      });

      canvas.on("mouse:up", () => {
        if (isPanning) {
          isPanning = false;
          canvas.setCursor("default");
          triggerSave(); // save viewport after pan
          return;
        }
        handleMouseUp(canvas);
      });

      canvas.on("mouse:wheel", (opt: any) => {
        const delta = opt.e.deltaY;
        let z = canvas.getZoom();
        z *= 0.999 ** delta;
        z = Math.max(0.1, Math.min(5, z));
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, z);
        setZoom(z);
        opt.e.preventDefault();
        opt.e.stopPropagation();
        triggerSave(); // save after zoom
      });

      // save after any object modification
      canvas.on("object:modified", triggerSave);
      canvas.on("object:added", triggerSave);
      canvas.on("object:removed", triggerSave);
      canvas.on("path:created", triggerSave); // freehand drawing complete

      ro = new ResizeObserver(() => {
        if (!container || !canvas) return;
        canvas.setDimensions({
          width: container.clientWidth,
          height: container.clientHeight,
        });
      });
      ro.observe(container);
    });

    return () => {
      ro?.disconnect();
      if (canvas) {
        try { canvas.dispose(); } catch {}
      }
      fabricRef.current = null;
      initializingRef.current = false;
    };
  }, [loading, savedState]); // eslint-disable-line

  // sync tool mode
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.isDrawingMode = activeTool === "draw";
    if (activeTool === "draw" && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = strokeColor;
      canvas.freeDrawingBrush.width = strokeWidth;
    }
    canvas.selection = activeTool === "select";
    canvas.forEachObject((obj: any) => {
      obj.selectable = activeTool === "select";
    });
  }, [activeTool, strokeColor, strokeWidth]);

  const handleDelete = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.getActiveObjects().forEach((obj: any) => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    triggerSave();
  }, [triggerSave]);

  const handleClearCanvas = useCallback(async () => {
    if (!confirm("Clear the entire canvas? This cannot be undone.")) return;
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.clear();
    canvas.backgroundColor = "#0A0A0F";
    canvas.requestRenderAll();
    setObjectCount(0);
    await clearCanvasState();
  }, [clearCanvasState]);

  const handleExport = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const dataURL = canvas.toDataURL({ format: "png", multiplier: 2 });
    const a = document.createElement("a");
    a.href = dataURL;
    a.download = `canvas-${Date.now()}.png`;
    a.click();
  }, []);

  const handleZoomIn = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const z = Math.min(5, canvas.getZoom() * 1.2);
    canvas.setZoom(z);
    setZoom(z);
    triggerSave();
  }, [triggerSave]);

  const handleZoomOut = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const z = Math.max(0.1, canvas.getZoom() / 1.2);
    canvas.setZoom(z);
    setZoom(z);
    triggerSave();
  }, [triggerSave]);

  const handleReset = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.setZoom(1);
    setZoom(1);
    triggerSave();
  }, [triggerSave]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return;
      const map: Record<string, CanvasTool> = {
        v: "select", d: "draw", r: "rect",
        c: "circle", l: "line", t: "text", s: "sticky",
      };
      if (map[e.key]) setActiveTool(map[e.key] as CanvasTool);
      if (e.key === "Delete" || e.key === "Backspace") handleDelete();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleDelete]);

  // show loading while fetching saved state
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
      <div className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-sm font-semibold">Canvas</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-xs text-muted-foreground">
              Alt+drag to pan · Scroll to zoom
            </p>
            {saving && (
              <span className="text-[10px] text-white/20 animate-pulse">
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
          onReset={handleReset}
          zoom={zoom}
        />

        {/* clear canvas button */}
        <button
          onClick={handleClearCanvas}
          title="Clear entire canvas"
          className="flex items-center gap-1.5 rounded-lg border border-destructive/20 px-3 py-1.5 text-xs text-destructive/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear all
        </button>
      </div>

      <div className="relative flex flex-1 overflow-hidden">
        <div ref={containerRef} className="flex-1 overflow-hidden">
          <canvas ref={canvasRef} />
        </div>
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
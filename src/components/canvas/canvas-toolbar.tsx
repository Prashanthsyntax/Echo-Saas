"use client";

import { cn } from "@/lib/utils";
import {
  MousePointer2,
  Pencil,
  Square,
  Circle,
  Type,
  StickyNote,
  Minus,
  Trash2,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export type CanvasTool =
  | "select"
  | "draw"
  | "rect"
  | "circle"
  | "line"
  | "text"
  | "sticky";

interface CanvasToolbarProps {
  activeTool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;
  onDelete: () => void;
  onExport: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  zoom: number;
}

const tools: { id: CanvasTool; icon: React.ElementType; label: string }[] = [
  { id: "select", icon: MousePointer2, label: "Select (V)" },
  { id: "draw", icon: Pencil, label: "Draw (D)" },
  { id: "rect", icon: Square, label: "Rectangle (R)" },
  { id: "circle", icon: Circle, label: "Circle (C)" },
  { id: "line", icon: Minus, label: "Line (L)" },
  { id: "text", icon: Type, label: "Text (T)" },
  { id: "sticky", icon: StickyNote, label: "Sticky note (S)" },
];

export function CanvasToolbar({
  activeTool,
  onToolChange,
  onDelete,
  onExport,
  onZoomIn,
  onZoomOut,
  onReset,
  zoom,
}: CanvasToolbarProps) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-card px-2 py-1.5 shadow-lg shadow-black/20">
      {/* drawing tools */}
      {tools.map((tool) => (
        <button
          key={tool.id}
          title={tool.label}
          onClick={() => onToolChange(tool.id)}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            activeTool === tool.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <tool.icon className="h-4 w-4" />
        </button>
      ))}

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* zoom controls */}
      <button
        title="Zoom out"
        onClick={onZoomOut}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ZoomOut className="h-4 w-4" />
      </button>

      <span className="min-w-[44px] text-center text-xs font-medium text-muted-foreground">
        {Math.round(zoom * 100)}%
      </span>

      <button
        title="Zoom in"
        onClick={onZoomIn}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <ZoomIn className="h-4 w-4" />
      </button>

      <button
        title="Reset view"
        onClick={onReset}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <RotateCcw className="h-4 w-4" />
      </button>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* actions */}
      <button
        title="Delete selected"
        onClick={onDelete}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <button
        title="Export as PNG"
        onClick={onExport}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Download className="h-4 w-4" />
      </button>
    </div>
  );
}
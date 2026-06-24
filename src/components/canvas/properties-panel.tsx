"use client";

import { ColorPicker } from "./color-picker";
import { Separator } from "@/components/ui/separator";

interface PropertiesPanelProps {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  onStrokeColorChange: (color: string) => void;
  onFillColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
}

export function PropertiesPanel({
  strokeColor,
  fillColor,
  strokeWidth,
  onStrokeColorChange,
  onFillColorChange,
  onStrokeWidthChange,
}: PropertiesPanelProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-3 shadow-lg shadow-black/20">
      <ColorPicker
        label="Stroke"
        color={strokeColor}
        onChange={onStrokeColorChange}
      />

      <Separator />

      <ColorPicker
        label="Fill"
        color={fillColor}
        onChange={onFillColorChange}
      />

      <Separator />

      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-muted-foreground">
          Stroke width: {strokeWidth}px
        </p>
        <input
          type="range"
          min={1}
          max={20}
          value={strokeWidth}
          onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>
    </div>
  );
}
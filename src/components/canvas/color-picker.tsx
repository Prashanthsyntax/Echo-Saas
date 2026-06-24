"use client";

const COLORS = [
  "#F4F4F5", // zinc-100 (white-ish)
  "#A1A1AA", // zinc-400 (gray)
  "#8B5CF6", // violet (primary)
  "#0EA5E9", // sky (accent)
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#EC4899", // pink
  "#000000", // black
];

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  label?: string;
}

export function ColorPicker({ color, onChange, label }: ColorPickerProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <p className="text-xs text-muted-foreground">{label}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {COLORS.map((c) => (
          <button
            key={c}
            title={c}
            onClick={() => onChange(c)}
            className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
            style={{
              backgroundColor: c,
              borderColor: color === c ? "hsl(263 70% 58%)" : "transparent",
            }}
          />
        ))}
      </div>
    </div>
  );
}
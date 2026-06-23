"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X } from "lucide-react";

interface VideoTitleProps {
  videoId: string;
  initialTitle: string;
  ownerId: string;
}

export function VideoTitle({
  videoId,
  initialTitle,
  ownerId,
}: VideoTitleProps) {
  const { user } = useUser();
  const [title, setTitle] = useState(initialTitle);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [saving, setSaving] = useState(false);

  // only the video owner can rename
  const canEdit = !!user;

  const handleSave = async () => {
    if (!draft.trim() || draft === title) {
      setEditing(false);
      setDraft(title);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/videos/${videoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: draft.trim() }),
      });

      if (!res.ok) throw new Error("Failed to save");
      setTitle(draft.trim());
      setEditing(false);
    } catch (err) {
      console.error(err);
      setDraft(title);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setEditing(false);
      setDraft(title);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className="h-8 text-lg font-semibold"
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={handleSave}
          disabled={saving}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => {
            setEditing(false);
            setDraft(title);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="group flex items-center gap-2">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {canEdit && (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
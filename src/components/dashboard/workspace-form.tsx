"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Building2 } from "lucide-react";

interface WorkspaceFormProps {
  workspace: { id: string; name: string } | null;
}

export function WorkspaceForm({ workspace }: WorkspaceFormProps) {
  const [name, setName] = useState(workspace?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!workspace || !name.trim()) return;
    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch(`/api/workspace/${workspace.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!workspace) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">No workspace yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Record a video to auto-create your first workspace
            </p>
          </div>
        </div>
      </div>
    );
  }

  const unchanged = name.trim() === workspace.name;

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-6">
      {/* workspace header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">{workspace.name}</p>
          <Badge variant="secondary" className="mt-0.5 text-xs">
            Personal workspace
          </Badge>
        </div>
      </div>

      <div className="border-t border-border" />

      {/* field */}
      <div className="space-y-1.5">
        <Label
          htmlFor="workspace-name"
          className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
        >
          Workspace name
        </Label>
        <Input
          id="workspace-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Workspace"
          className="bg-background"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
        <p className="text-xs text-muted-foreground">
          Shown in your dashboard and on shared video links
        </p>
      </div>

      {/* footer */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 text-xs text-primary">
          {saved && (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Changes saved
            </>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={saving || unchanged || !name.trim()}
          size="sm"
          className="min-w-[100px]"
        >
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
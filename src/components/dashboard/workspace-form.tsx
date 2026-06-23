"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface WorkspaceFormProps {
  workspace: { id: string; name: string } | null;
}

export function WorkspaceForm({ workspace }: WorkspaceFormProps) {
  const [name, setName] = useState(workspace?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!workspace) return;
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
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!workspace) {
    return (
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Workspace</CardTitle>
          <CardDescription>
            No workspace found — record a video first to auto-create one
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle className="text-base">Workspace</CardTitle>
        <CardDescription>
          Manage your workspace name and settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="workspace-name">Workspace name</Label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Workspace"
            className="max-w-sm"
          />
          <p className="text-xs text-muted-foreground">
            This appears in your dashboard and shared video links
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || name === workspace.name || !name.trim()}
          size="sm"
        >
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save changes"}
        </Button>
      </CardContent>
    </Card>
  );
}
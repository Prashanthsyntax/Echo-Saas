"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";

interface ProfileFormProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    imageUrl: string | null;
  };
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [name, setName] = useState(user.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (name.trim() === (user.name ?? "")) return;
    setSaving(true);
    setSaved(false);

    try {
      const res = await fetch("/api/user", {
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

  const unchanged = name.trim() === (user.name ?? "");

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-6">
      {/* avatar row */}
      <div className="flex items-center gap-5">
        <Avatar className="h-14 w-14 ring-2 ring-border ring-offset-2 ring-offset-background">
          <AvatarImage src={user.imageUrl ?? ""} />
          <AvatarFallback className="text-base font-medium bg-primary/10 text-primary">
            {user.name?.[0]?.toUpperCase() ??
              user.email[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {user.name ?? user.email}
          </p>
          <p className="truncate text-xs text-muted-foreground mt-0.5">
            {user.email}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Photo managed via your{" "}
            <span className="text-primary">Clerk account</span>
          </p>
        </div>
      </div>

      {/* divider */}
      <div className="border-t border-border" />

      {/* fields */}
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label
            htmlFor="name"
            className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
          >
            Display name
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="bg-background"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <p className="text-xs text-muted-foreground">
            Shown on your videos and comments
          </p>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="email"
            className="text-xs font-medium text-muted-foreground uppercase tracking-wider"
          >
            Email address
          </Label>
          <Input
            id="email"
            value={user.email}
            disabled
            className="bg-background opacity-50 cursor-not-allowed"
          />
          <p className="text-xs text-muted-foreground">
            Change your email via your Clerk account settings
          </p>
        </div>
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
          disabled={saving || unchanged}
          size="sm"
          className="min-w-[100px]"
        >
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
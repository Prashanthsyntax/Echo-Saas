"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Separator } from "@/components/ui/separator";

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
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>
            Update your display name and manage your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.imageUrl ?? ""} />
              <AvatarFallback className="text-lg">
                {user.name?.[0] ?? user.email[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">
                {user.name ?? "No name set"}
              </p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Profile photo managed via your Clerk account
              </p>
            </div>
          </div>

          <Separator />

          {/* name field */}
          <div className="space-y-2">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="max-w-sm"
            />
            <p className="text-xs text-muted-foreground">
              This is shown on your videos and comments
            </p>
          </div>

          {/* email — read only */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={user.email}
              disabled
              className="max-w-sm opacity-60"
            />
            <p className="text-xs text-muted-foreground">
              Managed via your Clerk account — change it there
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || name === user.name}
            size="sm"
          >
            {saving ? "Saving..." : saved ? "Saved ✓" : "Save changes"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
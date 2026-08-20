"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Trash2, Play, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Video } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface VideoCardProps {
  video: Video;
  canDelete?: boolean;
  uploaderName?: string;
  uploaderImage?: string;
}

export function VideoCard({
  video,
  canDelete = true,
  uploaderName,
  uploaderImage,
}: VideoCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this video permanently?")) return;
    setDeleting(true);
    await fetch(`/api/videos/${video.id}`, { method: "DELETE" });
    window.location.reload();
  };

  return (
    <div
      className={cn(
        "group overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/30",
        deleting && "opacity-50 pointer-events-none"
      )}
    >
      <Link href={`/v/${video.id}`}>
        <div className="relative aspect-video bg-gradient-to-br from-secondary to-background">
          {video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Play className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}
        </div>
      </Link>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link href={`/v/${video.id}`}>
              <p className="truncate text-sm font-medium hover:text-primary">
                {video.title}
              </p>
            </Link>

            {/* uploader info */}
            {uploaderName && (
              <div className="mt-1 flex items-center gap-1.5">
                <Avatar className="h-4 w-4">
                  <AvatarImage src={uploaderImage ?? ""} />
                  <AvatarFallback className="text-[8px]">
                    {uploaderName[0]}
                  </AvatarFallback>
                </Avatar>
                <p className="text-[11px] text-muted-foreground">
                  {uploaderName}
                </p>
              </div>
            )}

            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(video.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {video.viewCount > 0 && ` · ${video.viewCount} views`}
            </p>
          </div>

          {canDelete && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="rounded-lg p-1 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-secondary hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        handleDelete();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete video
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
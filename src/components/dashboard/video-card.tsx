"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Eye, Clock, MoreVertical, Trash2, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface VideoCardProps {
  video: {
    id: string;
    title: string;
    url: string | null;
    thumbnailUrl: string | null;
    duration: number | null;
    status: string;
    viewCount: number;
    createdAt: Date;
  };
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoCard({ video }: VideoCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm("Delete this video? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await fetch(`/api/videos/${video.id}`, { method: "DELETE" });
      router.refresh();
    } catch {
      setDeleting(false);
    }
  };

  const isReady = video.status === "READY";

  return (
    <Card
      className={cn(
        "group overflow-hidden border-border bg-card transition-colors hover:border-primary/30",
        deleting && "pointer-events-none opacity-50"
      )}
    >
      {/* thumbnail / preview area */}
      <Link href={`/v/${video.id}`}>
        <div className="relative aspect-video bg-secondary/30">
          {video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div className="space-y-2 text-center">
                <div className="mx-auto h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          )}

          {/* duration badge */}
          {video.duration && (
            <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
              {formatDuration(video.duration)}
            </div>
          )}

          {/* status badge for non-ready videos */}
          {!isReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Badge variant="secondary" className="text-xs">
                {video.status === "UPLOADING"
                  ? "Uploading..."
                  : video.status === "PROCESSING"
                  ? "Processing..."
                  : video.status}
              </Badge>
            </div>
          )}
        </div>
      </Link>

      {/* card footer */}
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link href={`/v/${video.id}`}>
              <p className="truncate text-sm font-medium hover:text-primary transition-colors">
                {video.title}
              </p>
            </Link>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {video.viewCount}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(video.createdAt), {
                  addSuffix: true,
                })}
              </span>
            </div>
          </div>

          {/* actions menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem asChild>
                <Link href={`/v/${video.id}`} className="flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Open
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className="flex items-center gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
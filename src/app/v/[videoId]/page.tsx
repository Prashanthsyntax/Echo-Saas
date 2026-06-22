import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { VideoPlayer } from "@/components/shared/video-player";
import { CommentsSection } from "@/components/shared/comments-section";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Eye, Calendar } from "lucide-react";

interface VideoPageProps {
  params: Promise<{ videoId: string }>;
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { videoId } = await params;

  const video = await db.video.findUnique({
    where: { id: videoId },
    include: {
      user: true,
      comments: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!video) notFound();

  // increment view count
  await db.video.update({
    where: { id: videoId },
    data: { viewCount: { increment: 1 } },
  });

  const createdAt = new Date(video.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="min-h-screen bg-background">
      {/* minimal nav — no full dashboard sidebar */}
      <header className="border-b border-border px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
              E
            </div>
            <span className="text-sm font-semibold tracking-tight">Echo</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {video.status === "READY" ? "Ready" : video.status}
          </Badge>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* left: video + metadata */}
          <div className="space-y-6">
            {/* video player */}
            <VideoPlayer url={video.url} title={video.title} />

            {/* metadata */}
            <div className="space-y-3">
              <h1 className="text-xl font-semibold tracking-tight">
                {video.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={video.user.imageUrl ?? ""} />
                    <AvatarFallback className="text-[10px]">
                      {video.user.name?.[0] ?? video.user.email[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span>{video.user.name ?? video.user.email}</span>
                </div>

                <div className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  <span>{video.viewCount} views</span>
                </div>

                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{createdAt}</span>
                </div>
              </div>

              {video.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {video.description}
                </p>
              )}
            </div>

            {/* AI transcript/summary — shown only when available */}
            {video.summary && (
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  AI Summary
                </p>
                <p className="text-sm leading-relaxed">{video.summary}</p>
              </div>
            )}

            {video.transcript && (
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Transcript
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {video.transcript}
                </p>
              </div>
            )}
          </div>

          {/* right: comments */}
          <div className="lg:sticky lg:top-8 lg:h-fit">
            <CommentsSection
              videoId={videoId}
              initialComments={video.comments}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
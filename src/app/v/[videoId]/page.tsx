import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { VideoTitle } from "@/components/shared/video-title";
import { VideoPlayer } from "@/components/shared/video-player";
import { TranscriptPoller } from "@/components/shared/transcript-poller";
import { CommentsSection } from "@/components/shared/comments-section";
import { StructuredNotes } from "@/components/video/structured-notes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Eye, Calendar, FileText } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { hasPermission } from "@/lib/permissions";

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

  // resolve the current user's edit permission for this video's workspace
  const { userId } = await auth();
  let canEditNotes = false;

  if (userId) {
    const user = await db.user.findUnique({ where: { clerkId: userId } });
    if (user && video.workspaceId) {
      const membership = await db.membership.findUnique({
        where: {
          userId_workspaceId: {
            userId: user.id,
            workspaceId: video.workspaceId,
          },
        },
      });
      canEditNotes = membership
        ? hasPermission(membership.role, "UPLOAD_VIDEO")
        : false;
    }
  }

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

            {/* AI notes */}
            <div className="mt-8">
              <div className="mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-white/30" />
                <h2 className="text-sm font-semibold text-white">AI Notes</h2>
                <Badge
                  className="border-0 text-[10px]"
                  style={{
                    backgroundColor: "rgba(139,92,246,0.15)",
                    color: "#a78bfa",
                  }}
                >
                  echo-nemo-1.0
                </Badge>
              </div>

              {/*
                NOTE: We intentionally do NOT pass an onTimestampClick
                function prop here. This page is an async Server Component
                (it calls db/auth directly), and functions cannot be passed
                as props from a Server Component to a Client Component —
                they aren't serializable across that boundary.

                StructuredNotes is already a Client Component (it needs
                onClick handlers for its own UI), so it should own the
                seek-to-timestamp behavior internally, e.g.:

                  "use client";
                  function handleTimestampClick(seconds: number) {
                    const videoEl = document.querySelector("video");
                    if (videoEl) videoEl.currentTime = seconds;
                  }

                and call that directly from its own click handlers instead
                of expecting a callback prop from this page.
              */}
              <StructuredNotes videoId={video.id} canEdit={canEditNotes} />
            </div>

            {/* metadata */}
            <div className="space-y-3">
              <VideoTitle
                videoId={video.id}
                initialTitle={video.title}
                ownerId={video.userId}
              />

              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={video.user.imageUrl ?? ""} />
                    <AvatarFallback className="text-[10px]">
                      {video.user.name?.[0] ??
                        video.user.email[0].toUpperCase()}
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
            <TranscriptPoller
              videoId={videoId}
              initialTranscript={video.transcript}
              initialSummary={video.summary}
              initialTitle={video.title}
            />
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
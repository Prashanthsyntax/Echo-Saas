import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { VideoCard } from "@/components/dashboard/video-card";
import { Search } from "@/components/dashboard/search";
import { Suspense } from "react";
import type { Metadata } from "next";
import { hasPermission } from "@/lib/permissions";
import type { Role } from "@prisma/client";

export const metadata: Metadata = { title: "Library" };

interface DashboardPageProps {
  searchParams: Promise<{ q?: string; workspace?: string }>;
}

async function VideoGrid({
  userId,
  query,
  workspaceId,
  userRole,
}: {
  userId: string;
  query?: string;
  workspaceId?: string;
  userRole: Role;
}) {
  const clerkUser = await currentUser();

  let user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user && clerkUser) {
    user = await db.user.create({
      data: {
        clerkId: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
        name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null,
        imageUrl: clerkUser.imageUrl,
      },
    });
  }
  if (!user) return null;

  // workspace-scoped query — ALL videos in this workspace
  const videos = await db.video.findMany({
    where: {
      ...(workspaceId ? { workspaceId } : { userId: user.id }),
      ...(query ? { title: { contains: query, mode: "insensitive" as const } } : {}),
      status: "READY",
    },
    include: {
      user: {
        select: { id: true, name: true, imageUrl: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const canUpload = hasPermission(userRole, "UPLOAD_VIDEO");

  if (videos.length === 0) {
    return (
      <div className="mt-24 flex flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
          <Plus className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="mt-5 text-lg font-medium">
          {query ? `No videos matching "${query}"` : "No videos yet"}
        </h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {query
            ? "Try a different search term."
            : canUpload
            ? "Record your first video to get started."
            : "No videos have been recorded in this workspace yet."}
        </p>
        {!query && canUpload && (
          <Button asChild className="mt-6 gap-2">
            <Link href="/record">
              <Plus className="h-4 w-4" />
              Start recording
            </Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          canDelete={
            hasPermission(userRole, "DELETE_VIDEO") ||
            video.userId === user?.id
          }
          uploaderName={video.user.name ?? undefined}
          uploaderImage={video.user.imageUrl ?? undefined}
        />
      ))}
    </div>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { q: query, workspace: workspaceId } = await searchParams;

  // get user's role in this workspace
  let userRole: Role = "VIEWER";
  if (workspaceId) {
    const user = await db.user.findUnique({ where: { clerkId: userId } });
    if (user) {
      const membership = await db.membership.findUnique({
        where: { userId_workspaceId: { userId: user.id, workspaceId } },
      });
      userRole = membership?.role ?? "VIEWER";
    }
  }

  const canUpload = hasPermission(userRole, "UPLOAD_VIDEO");

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All recordings in this workspace
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Suspense>
            <Search />
          </Suspense>
          {canUpload && (
            <Button asChild>
              <Link href="/record" className="gap-2">
                <Plus className="h-4 w-4" />
                New recording
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Suspense
        key={`${query}-${workspaceId}`}
        fallback={
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-video animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        }
      >
        <VideoGrid
          userId={userId}
          query={query}
          workspaceId={workspaceId}
          userRole={userRole}
        />
      </Suspense>
    </div>
  );
}
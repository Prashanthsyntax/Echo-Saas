import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { VideoCard } from "@/components/dashboard/video-card";
import { Search } from "@/components/dashboard/search";
import { Suspense } from "react";

interface DashboardPageProps {
  searchParams: Promise<{ q?: string }>;
}

async function VideoGrid({
  userId,
  query,
}: {
  userId: string;
  query?: string;
}) {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  let user = await db.user.findUnique({ where: { clerkId: userId } });

  if (!user) {
    user = await db.user.create({
      data: {
        clerkId: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
        name:
          [clerkUser.firstName, clerkUser.lastName]
            .filter(Boolean)
            .join(" ") || null,
        imageUrl: clerkUser.imageUrl,
      },
    });
  }

  const videos = await db.video.findMany({
    where: {
      userId: user.id,
      ...(query
        ? { title: { contains: query, mode: "insensitive" } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  if (videos.length === 0) {
    return (
      <div className="mt-24 flex flex-col items-center justify-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
          <Plus className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="mt-5 text-lg font-medium">
          {query ? `No videos matching "${query}"` : "Record your first video"}
        </h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          {query
            ? "Try a different search term."
            : "Hit record, talk through whatever's on your screen, and get a shareable link in seconds."}
        </p>
        {!query && (
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
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { q: query } = await searchParams;

  return (
    <div className="p-8">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your recordings, all in one place
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Suspense>
            <Search />
          </Suspense>
          <Button asChild>
            <Link href="/record" className="gap-2">
              <Plus className="h-4 w-4" />
              New recording
            </Link>
          </Button>
        </div>
      </div>

      {/* video grid */}
      <Suspense
        key={query}
        fallback={
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-video animate-pulse rounded-xl bg-secondary"
              />
            ))}
          </div>
        }
      >
        <VideoGrid userId={userId} query={query} />
      </Suspense>
    </div>
  );
}
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Video, Plus } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await db.user.findUnique({ where: { clerkId: userId } });

  const videos = user
    ? await db.video.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {videos.length === 0
              ? "No videos yet"
              : `${videos.length} video${videos.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button asChild>
          <Link href="/record" className="gap-2">
            <Plus className="h-4 w-4" />
            New recording
          </Link>
        </Button>
      </div>

      {videos.length === 0 ? (
        <div className="mt-24 flex flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
            <Video className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="mt-5 text-lg font-medium">
            Record your first video
          </h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Hit record, talk through whatevers on your screen, and get a
            shareable link in seconds.
          </p>
          <Button asChild className="mt-6 gap-2">
            <Link href="/record">
              <Plus className="h-4 w-4" />
              Start recording
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* video cards will go here once recording is built */}
        </div>
      )}
    </div>
  );
}
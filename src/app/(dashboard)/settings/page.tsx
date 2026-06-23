import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ProfileForm } from "@/components/dashboard/profile-form";
import { WorkspaceForm } from "@/components/dashboard/workspace-form";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const clerkUser = await currentUser();
  if (!clerkUser) redirect("/sign-in");

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

  const workspace = await db.workspace.findFirst({
    where: { memberships: { some: { userId: user.id } } },
  });

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl">
        {/* page header */}
        <div className="mb-10">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Manage your profile and workspace preferences
          </p>
        </div>

        {/* two-column settings layout */}
        <div className="space-y-10">
          {/* section: Profile */}
          <div className="grid gap-8 md:grid-cols-[200px_1fr]">
            <div>
              <h2 className="text-sm font-medium">Profile</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Your public identity across Echo — shown on videos and comments.
              </p>
            </div>
            <ProfileForm
              user={{
                id: user.id,
                name: user.name,
                email: user.email,
                imageUrl: user.imageUrl,
              }}
            />
          </div>

          {/* divider */}
          <div className="border-t border-border" />

          {/* section: Workspace */}
          <div className="grid gap-8 md:grid-cols-[200px_1fr]">
            <div>
              <h2 className="text-sm font-medium">Workspace</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Shared settings for your team and recording workspace.
              </p>
            </div>
            <WorkspaceForm
              workspace={
                workspace
                  ? { id: workspace.id, name: workspace.name }
                  : null
              }
            />
          </div>

          {/* divider */}
          <div className="border-t border-border" />

          {/* section: Danger zone */}
          <div className="grid gap-8 md:grid-cols-[200px_1fr]">
            <div>
              <h2 className="text-sm font-medium text-destructive">
                Danger zone
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                Irreversible actions — proceed with care.
              </p>
            </div>
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Delete account</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Permanently delete your account, all videos, and workspace
                    data. This cannot be undone.
                  </p>
                </div>
                <button
                  disabled
                  className="shrink-0 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive opacity-60 cursor-not-allowed"
                >
                  Delete account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
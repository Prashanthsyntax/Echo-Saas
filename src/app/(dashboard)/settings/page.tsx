import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile and workspace preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="max-w-2xl">
        <TabsList className="mb-8">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileForm
            user={{
              id: user.id,
              name: user.name,
              email: user.email,
              imageUrl: user.imageUrl,
            }}
          />
        </TabsContent>

        <TabsContent value="workspace">
          <WorkspaceForm
            workspace={
              workspace
                ? { id: workspace.id, name: workspace.name }
                : null
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
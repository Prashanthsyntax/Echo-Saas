import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect(`/sign-in?redirect_url=/invite/${token}`);
  }

  const invite = await db.invite.findUnique({
    where: { token },
    include: { workspace: true },
  });

  if (!invite) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Invalid invite link</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This invite link is invalid or has already been used.
          </p>
          <Button asChild className="mt-4">
            <Link href="/overview">Go to dashboard</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (invite.accepted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Invite already used</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This invite link has already been accepted.
          </p>
          <Button asChild className="mt-4">
            <Link href="/overview">Go to dashboard</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (new Date() > invite.expiresAt) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Invite expired</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This invite link expired after 7 days. Ask your admin to send a new one.
          </p>
          <Button asChild className="mt-4">
            <Link href="/overview">Go to dashboard</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mx-auto">
          <span className="text-2xl">👥</span>
        </div>
        <h1 className="mt-4 text-lg font-semibold">
          Join {invite.workspace.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;ve been invited to collaborate in this workspace on Echo.
        </p>
        <AcceptInviteButton
          workspaceId={invite.workspaceId}
          token={token}
        />
        <Button variant="ghost" size="sm" asChild className="mt-2 w-full">
          <Link href="/overview">Decline</Link>
        </Button>
      </div>
    </main>
  );
}

function AcceptInviteButton({
  workspaceId,
  token,
}: {
  workspaceId: string;
  token: string;
}) {
  return (
    <form
      action={async () => {
        "use server";
        const { auth } = await import("@clerk/nextjs/server");
        const { userId } = await auth();
        if (!userId) return;

        await fetch(
          `${process.env.APP_URL}/api/workspaces/${workspaceId}/invite/${token}`,
          { method: "POST", headers: { "Content-Type": "application/json" } }
        );

        redirect(`/overview`);
      }}
    >
      <Button type="submit" className="mt-6 w-full">
        Accept and join workspace
      </Button>
    </form>
  );
}
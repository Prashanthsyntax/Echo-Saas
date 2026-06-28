import { auth, currentUser } from "@clerk/nextjs/server";
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
      <ErrorState
        title="Invalid invite link"
        message="This invite link is invalid or doesn't exist."
      />
    );
  }

  if (invite.accepted) {
    return (
      <ErrorState
        title="Already accepted"
        message="This invite link has already been used."
      />
    );
  }

  if (new Date() > invite.expiresAt) {
    return (
      <ErrorState
        title="Invite expired"
        message="This invite link expired after 7 days. Ask your admin to send a new one."
      />
    );
  }

  // check if already a member
  const clerkUser = await currentUser();
  if (!clerkUser) redirect("/sign-in");

  let user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    user = await db.user.create({
      data: {
        clerkId: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
        name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null,
        imageUrl: clerkUser.imageUrl,
      },
    });
  }

  const existing = await db.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId: invite.workspaceId,
      },
    },
  });

  if (existing) {
    return (
      <ErrorState
        title="Already a member"
        message={`You're already a member of ${invite.workspace.name}.`}
        cta="Go to dashboard"
        ctaHref="/overview"
      />
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6"
      style={{ backgroundColor: "#0a0a0a" }}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 p-8 text-center"
        style={{ backgroundColor: "#111114" }}>

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <span className="text-3xl">👥</span>
        </div>

        <h1 className="mt-5 text-lg font-semibold text-white">
          Join {invite.workspace.name}
        </h1>
        <p className="mt-2 text-sm text-white/40">
          You&apos;ve been invited to collaborate in this workspace on Echo.
        </p>

        <p className="mt-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-xs text-white/30">
          Joining as <span className="text-white/60">{user.email}</span>
        </p>

        {/* Server action form — writes directly to DB, no fetch needed */}
        <form
          className="mt-6 space-y-2"
          action={async () => {
            "use server";

            const { auth: getAuth, currentUser: getClerkUser } = await import("@clerk/nextjs/server");
            const { userId: uid } = await getAuth();
            if (!uid) return;

            const { db: database } = await import("@/lib/db");

            // re-fetch invite inside server action for freshness
            const freshInvite = await database.invite.findUnique({
              where: { token },
            });

            if (!freshInvite || freshInvite.accepted) return;
            if (new Date() > freshInvite.expiresAt) return;

            // get or create user
            let dbUser = await database.user.findUnique({
              where: { clerkId: uid },
            });

            if (!dbUser) {
              const cu = await getClerkUser();
              if (!cu) return;
              dbUser = await database.user.create({
                data: {
                  clerkId: uid,
                  email: cu.emailAddresses[0]?.emailAddress ?? "",
                  name: [cu.firstName, cu.lastName].filter(Boolean).join(" ") || null,
                  imageUrl: cu.imageUrl,
                },
              });
            }

            // check not already a member
            const alreadyMember = await database.membership.findUnique({
              where: {
                userId_workspaceId: {
                  userId: dbUser.id,
                  workspaceId: freshInvite.workspaceId,
                },
              },
            });

            if (!alreadyMember) {
              await database.membership.create({
                data: {
                  userId: dbUser.id,
                  workspaceId: freshInvite.workspaceId,
                  role: freshInvite.role,
                },
              });
            }

            // mark invite as accepted
            await database.invite.update({
              where: { token },
              data: { accepted: true },
            });

            redirect("/overview");
          }}
        >
          <button
            type="submit"
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            Accept and join workspace
          </button>
          <Link
            href="/overview"
            className="block w-full rounded-xl px-4 py-2.5 text-sm text-white/30 transition-colors hover:text-white/60"
          >
            Decline
          </Link>
        </form>
      </div>
    </main>
  );
}

function ErrorState({
  title,
  message,
  cta = "Go to dashboard",
  ctaHref = "/overview",
}: {
  title: string;
  message: string;
  cta?: string;
  ctaHref?: string;
}) {
  return (
    <main
      className="flex min-h-screen items-center justify-center px-6"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 p-8 text-center"
        style={{ backgroundColor: "#111114" }}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <span className="text-3xl">⚠️</span>
        </div>
        <h1 className="mt-5 text-lg font-semibold text-white">{title}</h1>
        <p className="mt-2 text-sm text-white/40">{message}</p>
        <Link
          href={ctaHref}
          className="mt-6 block w-full rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white/60 transition-colors hover:bg-white/8 hover:text-white"
        >
          {cta}
        </Link>
      </div>
    </main>
  );
}
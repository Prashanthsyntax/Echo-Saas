import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
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
    return <InviteError title="Invalid invite" message="This invite link doesn't exist or has already been used." />;
  }

  if (invite.accepted) {
    return <InviteError title="Already used" message="This invite has already been accepted." />;
  }

  if (new Date() > invite.expiresAt) {
    return <InviteError title="Invite expired" message="This invite expired after 7 days. Ask your admin to send a new one." />;
  }

  // check if already a member
  const clerkUser = await currentUser();
  if (!clerkUser) redirect("/sign-in");

  // get or create the User row for the invited person
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

  // check if already a member of this specific workspace
  const existingMembership = await db.membership.findUnique({
    where: {
      userId_workspaceId: {
        userId: user.id,
        workspaceId: invite.workspaceId,
      },
    },
  });

  if (existingMembership) {
    return (
      <InviteSuccess
        workspaceName={invite.workspace.name}
        workspaceId={invite.workspaceId}
        alreadyMember
      />
    );
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center px-6"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 p-8 text-center"
        style={{ backgroundColor: "#111114" }}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <span className="text-3xl">👥</span>
        </div>
        <h1 className="mt-5 text-lg font-semibold text-white">
          Join {invite.workspace.name}
        </h1>
        <p className="mt-2 text-sm text-white/40">
          You&apos;ve been invited to collaborate in this workspace.
        </p>
        <p className="mt-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-xs text-white/30">
          Joining as{" "}
          <span className="font-medium text-white/60">{user.email}</span>
        </p>

        {/* Server Action — writes directly to DB, no fetch needed */}
        <form className="mt-6 space-y-2">
          <button
            formAction={async () => {
              "use server";

              // re-import inside server action
              const { auth: getAuth } = await import("@clerk/nextjs/server");
              const { db: database } = await import("@/lib/db");
              const { redirect: doRedirect } = await import("next/navigation");

              const { userId: uid } = await getAuth();
              if (!uid) return;

              // re-validate invite freshness
              const freshInvite = await database.invite.findUnique({
                where: { token },
              });

              if (!freshInvite || freshInvite.accepted) {
                doRedirect("/overview");
                return;
              }

              if (new Date() > freshInvite.expiresAt) {
                doRedirect("/overview");
                return;
              }

              // get the user row
              let dbUser = await database.user.findUnique({
                where: { clerkId: uid },
              });

              if (!dbUser) {
                const { currentUser: getClerkUser } = await import(
                  "@clerk/nextjs/server"
                );
                const cu = await getClerkUser();
                if (!cu) return;
                dbUser = await database.user.create({
                  data: {
                    clerkId: uid,
                    email: cu.emailAddresses[0]?.emailAddress ?? "",
                    name:
                      [cu.firstName, cu.lastName].filter(Boolean).join(" ") ||
                      null,
                    imageUrl: cu.imageUrl,
                  },
                });
              }

              // check membership doesn't already exist
              const alreadyMember = await database.membership.findUnique({
                where: {
                  userId_workspaceId: {
                    userId: dbUser.id,
                    workspaceId: freshInvite.workspaceId,
                  },
                },
              });

              if (!alreadyMember) {
                // CREATE THE MEMBERSHIP — this is what was silently failing
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

              // redirect to overview — workspace switcher will auto-load
              // the new workspace on next fetch
              doRedirect("/overview");
            }}
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

// ── helper components ──────────────────────────────────────────────────────

function InviteError({ title, message }: { title: string; message: string }) {
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
          href="/overview"
          className="mt-6 block w-full rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white/60 transition-colors hover:bg-white/8 hover:text-white"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}

function InviteSuccess({
  workspaceName,
  workspaceId,
  alreadyMember = false,
}: {
  workspaceName: string;
  workspaceId: string;
  alreadyMember?: boolean;
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
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
          <span className="text-3xl">✅</span>
        </div>
        <h1 className="mt-5 text-lg font-semibold text-white">
          {alreadyMember ? "Already a member" : "You're in!"}
        </h1>
        <p className="mt-2 text-sm text-white/40">
          {alreadyMember
            ? `You're already a member of ${workspaceName}.`
            : `You've joined ${workspaceName} successfully.`}
        </p>
        <Link
          href="/overview"
          className="mt-6 block w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          Open dashboard
        </Link>
      </div>
    </main>
  );
}
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { BillingClient } from "@/components/dashboard/billing-client";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { success, canceled } = await searchParams;

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) redirect("/sign-in");

  const workspace = await db.workspace.findFirst({
    where: { memberships: { some: { userId: user.id } } },
    include: { subscription: true },
  });

  const isPro = workspace?.plan === "PRO";
  const subscription = workspace?.subscription ?? null;

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your subscription and billing details
        </p>
      </div>

      <BillingClient
        isPro={isPro}
        subscription={
          subscription
            ? {
                status: subscription.status,
                plan: subscription.plan,
                currentPeriodEnd: subscription.currentPeriodEnd,
              }
            : null
        }
        successMessage={success === "true"}
        canceledMessage={canceled === "true"}
      />
    </div>
  );
}
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature" },
      { status: 400 }
    );
  }

  let event: import("stripe").Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Stripe webhook verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data
          .object as import("stripe").Stripe.Checkout.Session;

        if (session.mode !== "subscription") break;

        const workspaceId = session.metadata?.workspaceId;
        const subscriptionId = session.subscription as string;

        if (!workspaceId || !subscriptionId) break;

        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);

        await db.subscription.upsert({
          where: { workspaceId },
          update: {
            stripeSubscriptionId: subscriptionId,
            status: subscription.status,
            plan: "PRO",
            currentPeriodEnd: new Date(
              subscription.current_period_end * 1000
            ),
          },
          create: {
            workspaceId,
            stripeSubscriptionId: subscriptionId,
            status: subscription.status,
            plan: "PRO",
            currentPeriodEnd: new Date(
              subscription.current_period_end * 1000
            ),
          },
        });

        await db.workspace.update({
          where: { id: workspaceId },
          data: { plan: "PRO" },
        });

        console.log("✅ Subscription created for workspace:", workspaceId);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data
          .object as import("stripe").Stripe.Subscription;

        const existing = await db.subscription.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        });

        if (!existing) break;

        await db.subscription.update({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: subscription.status,
            currentPeriodEnd: new Date(
              subscription.current_period_end * 1000
            ),
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data
          .object as import("stripe").Stripe.Subscription;

        const existing = await db.subscription.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        });

        if (!existing) break;

        await db.subscription.update({
          where: { stripeSubscriptionId: subscription.id },
          data: { status: "canceled", plan: "FREE" },
        });

        await db.workspace.update({
          where: { id: existing.workspaceId },
          data: { plan: "FREE" },
        });

        console.log("Subscription canceled for workspace:", existing.workspaceId);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
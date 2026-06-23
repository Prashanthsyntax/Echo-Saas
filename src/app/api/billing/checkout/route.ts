import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const workspace = await db.workspace.findFirst({
    where: { memberships: { some: { userId: user.id } } },
    include: { subscription: true },
  });

  if (!workspace) {
    return NextResponse.json(
      { error: "No workspace found" },
      { status: 404 }
    );
  }

  if (workspace.plan === "PRO") {
    return NextResponse.json(
      { error: "Already on Pro plan" },
      { status: 400 }
    );
  }

  // get or create Stripe customer
  let stripeCustomerId = workspace.stripeCustomerId;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { workspaceId: workspace.id, userId: user.id },
    });
    stripeCustomerId = customer.id;

    await db.workspace.update({
      where: { id: workspace.id },
      data: { stripeCustomerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: process.env.STRIPE_PRO_PRICE_ID!,
        quantity: 1,
      },
    ],
    metadata: { workspaceId: workspace.id },
    success_url: `${process.env.APP_URL}/billing?success=true`,
    cancel_url: `${process.env.APP_URL}/billing?canceled=true`,
  });

  return NextResponse.json({ url: session.url });
}
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

export async function POST() {
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
  });

  if (!workspace?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account found" },
      { status: 404 }
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: workspace.stripeCustomerId,
    return_url: `${process.env.APP_URL}/billing`,
  });

  return NextResponse.json({ url: session.url });
}
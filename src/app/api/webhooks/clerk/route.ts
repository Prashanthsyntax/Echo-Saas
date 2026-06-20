import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("Missing CLERK_WEBHOOK_SECRET in .env");
  }

  // 1. Get the headers Clerk sends for verification
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  // 2. Get the raw body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // 3. Verify the webhook signature
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  // 4. Handle the event
  const eventType = evt.type;

  if (eventType === "user.created" || eventType === "user.updated") {
    const { id, email_addresses, first_name, last_name, image_url } =
      evt.data;

    const email = email_addresses[0]?.email_address;

    if (!email) {
      return new Response("No email found on user", { status: 400 });
    }

    const name = [first_name, last_name].filter(Boolean).join(" ") || null;

    try {
      const result = await db.user.upsert({
        where: { clerkId: id },
        update: { email, name, imageUrl: image_url },
        create: { clerkId: id, email, name, imageUrl: image_url },
      });
      console.log("✅ User upserted:", result);
    } catch (err) {
      console.error("❌ DB upsert failed:", err);
      return new Response("Database error", { status: 500 });
    }
  }

  if (eventType === "user.deleted") {
    const { id } = evt.data;
    if (id) {
      await db.user.deleteMany({ where: { clerkId: id } });
    }
  }

  return new Response("Webhook processed", { status: 200 });
}
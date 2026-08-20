import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// Called by a cron job or manually to clean up stale sessions
// Add to vercel.json for automatic cleanup
export async function POST() {
  const cutoff = new Date(Date.now() - 60 * 1000); // 60 seconds ago

  const deleted = await db.presenceSession.deleteMany({
    where: { lastSeen: { lt: cutoff } },
  });

  return NextResponse.json({ deleted: deleted.count });
}
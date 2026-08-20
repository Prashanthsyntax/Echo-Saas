import { db } from "@/lib/db";
import type { ActivityType, Prisma } from "@prisma/client";

interface LogActivityParams {
  workspaceId: string;
  userId: string;        // internal DB user ID (not clerkId)
  type: ActivityType;
  description: string;
  metadata?: Prisma.InputJsonValue;
}

export async function logActivity({
  workspaceId,
  userId,
  type,
  description,
  metadata,
}: LogActivityParams): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        workspaceId,
        userId,
        type,
        description,
        metadata: metadata ?? {},
      },
    });
  } catch (err) {
    // non-fatal — never crash the main operation because logging failed
    console.error("Activity log failed:", err);
  }
}

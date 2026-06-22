import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { videoId } = await params;
  const { content } = await req.json();

  if (!content?.trim()) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // find or create user
  let user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    user = await db.user.create({
      data: {
        clerkId: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? "",
        name: [clerkUser.firstName, clerkUser.lastName]
          .filter(Boolean)
          .join(" ") || null,
        imageUrl: clerkUser.imageUrl,
      },
    });
  }

  const comment = await db.comment.create({
    data: {
      content: content.trim(),
      videoId,
      userId: user.id,
    },
    include: { user: true },
  });

  return NextResponse.json(comment);
}
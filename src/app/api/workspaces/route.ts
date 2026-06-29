import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ workspaces: [] });

  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: {
      workspace: {
        include: {
          memberships: { include: { user: true } },
          _count: { select: { videos: true } },
        },
      },
    },
  });

  return NextResponse.json({
    workspaces: memberships.map((m) => ({
      ...m.workspace,
      role: m.role,
    })),
  });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clerkUser = await currentUser();
  if (!clerkUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

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

  const workspace = await db.workspace.create({
    data: {
      name: name.trim(),
      memberships: {
        create: { userId: user.id, role: "OWNER" },
      },
    },
    include: {
      memberships: { include: { user: true } },
      _count: { select: { videos: true } },
    },
  });

  return NextResponse.json({ ...workspace, role: "OWNER" });
}
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // always get or create the user row first
  const clerkUser = await currentUser();
  let user = await db.user.findUnique({ where: { clerkId: userId } });

  if (!user && clerkUser) {
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

  if (!user) return NextResponse.json({ workspaces: [] });

  // fetch ALL workspaces this user is a member of
  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: {
      workspace: {
        include: {
          memberships: {
            include: {
              user: {
                select: { id: true, name: true, email: true, imageUrl: true },
              },
            },
          },
          subscription: true,
          _count: { select: { videos: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const workspaces = memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    plan: m.workspace.plan,
    role: m.role,
    subscription: m.workspace.subscription,
    memberships: m.workspace.memberships,
    _count: m.workspace._count,
  }));

  return NextResponse.json({ workspaces });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
        name:
          [clerkUser.firstName, clerkUser.lastName]
            .filter(Boolean)
            .join(" ") || null,
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
      memberships: {
        include: {
          user: {
            select: { id: true, name: true, email: true, imageUrl: true },
          },
        },
      },
      subscription: true,
      _count: { select: { videos: true } },
    },
  });

  return NextResponse.json({
    id: workspace.id,
    name: workspace.name,
    plan: workspace.plan,
    role: "OWNER",
    subscription: workspace.subscription,
    memberships: workspace.memberships,
    _count: workspace._count,
  });
}

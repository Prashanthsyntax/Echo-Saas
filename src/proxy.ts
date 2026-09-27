import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isSentraApiRoute = createRouteMatcher(["/api/sentra(.*)"]);

const isProtectedRoute = createRouteMatcher([
  "/overview(.*)",
  "/dashboard(.*)",
  "/record(.*)",
  "/canvas(.*)",
  "/workflows(.*)",
  "/knowledge(.*)",
  "/chat(.*)",
  "/agents(.*)",
  "/settings(.*)", // already covers /settings/workspace
  "/billing(.*)",
  "/api/rag(.*)",
  "/api/agents(.*)",
  "/api/presence(.*)",
  "/api/canvas(.*)",
  "/api/knowledge(.*)",
  "/api/chat(.*)",
  "/api/workspaces(.*)",
  "/api/overview(.*)",
  "/knowledge-health(.*)",
  "/api/knowledge(.*)",
  "/kanban(.*)",
  "/api/kanban(.*)",
  "/scheduler(.*)",
  "/api/scheduler(.*)",
  "/sentracode(.*)",
  "/api/sentra(.*)",
  "/api/sentra/attack-paths(.*)",
  "/api/sentra/fix(.*)",
  "/api/sentra/report(.*)",
  "/api/sentra/attack-paths/graph(.*)",
  "/workspace-chat(.*)",
  "/api/workspace-chat(.*)",
  "/api/pusher(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const isCliRequest =
    req.headers.get("x-sentra-cli") === "1" ||
    Boolean(req.headers.get("x-sentra-apikey"));

  if (isSentraApiRoute(req) && isCliRequest) {
    return NextResponse.next();
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

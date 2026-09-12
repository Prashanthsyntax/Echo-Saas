import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

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
]);

export default clerkMiddleware(async (auth, req) => {
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

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
  "/rag(.*)",
  "/settings(.*)",
  "/billing(.*)",
  "/api/rag(.*)",
  "/api/agents(.*)",
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
// Anzu Dynamics — Clerk Auth Middleware
// Protects all routes except public marketing pages, auth flows,
// webhooks, health checks, and shareable demo-preview links.

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublic = createRouteMatcher([
  // Marketing + landing pages
  "/",
  "/pricing(.*)",
  "/status(.*)",
  "/demo(.*)",
  // Clerk auth pages
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Vendor portal (unauthenticated invoice upload)
  "/portal",
  "/portal/sign-in(.*)",
  "/portal/sign-up(.*)",
  // Shareable no-login demo preview sessions
  "/demo-preview(.*)",
  // Webhooks + health
  "/api/webhooks(.*)",
  "/api/status(.*)",
  "/api/upload",       // unauthenticated upload (email/name provided in form)
  "/api/health",
]);

export default clerkMiddleware((auth, req) => {
  if (!isPublic(req)) auth().protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

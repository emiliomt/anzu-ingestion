// Anzu Dynamics — Clerk Auth + Multi-Tenant Middleware
// Protects all routes; enforces org membership on admin/dashboard routes.
// Role-checking is done inside API handlers — middleware only ensures auth + org presence.

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// ── Public routes — no Clerk session required ──────────────────────────────────
const isPublic = createRouteMatcher([
  // Marketing + landing pages
  "/",
  "/pricing(.*)",
  "/status(.*)",
  "/demo(.*)",
  // Clerk sign-in/sign-up
  "/sign-in(.*)",
  "/sign-up(.*)",
  // Vendor / supplier portal (unauthenticated invoice upload)
  "/portal",
  "/portal/sign-in(.*)",
  "/portal/sign-up(.*)",
  // Shareable no-login demo preview (token validated inside page)
  "/demo-preview(.*)",
  // Org-required redirect page (must be public to avoid redirect loop)
  "/org-required",
  // Webhooks — verified by their own signatures (Stripe, SendGrid, Twilio)
  "/api/webhooks(.*)",
  // Other public API endpoints
  "/api/status(.*)",
  "/api/upload",   // unauthenticated vendor upload (email/name in form)
  "/api/health",
]);

// ── Routes that require BOTH auth AND an active Clerk organization ─────────────
const requiresOrg = createRouteMatcher([
  "/admin(.*)",
  "/matcher(.*)",
  "/preaccounting(.*)",
  "/api/invoices(.*)",
  "/api/projects(.*)",
  "/api/purchase-orders(.*)",
  "/api/matching(.*)",
  "/api/export(.*)",
  "/api/erp-profiles(.*)",
  "/api/caja-chica(.*)",
  "/api/custom-fields(.*)",
  "/api/settings(.*)",
  "/api/credentials(.*)",
  "/api/tenant(.*)",
  "/api/jobs(.*)",
  "/api/metrics(.*)",
  "/api/preaccounting(.*)",
  "/api/fine-tune(.*)",
  "/api/training(.*)",
  "/api/security(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // Public routes — skip all checks
  if (isPublic(req)) return NextResponse.next();

  const session = await auth();
  const { userId, orgId } = session;

  // Not authenticated — redirect to sign-in
  if (!userId) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(signInUrl);
  }

  // Authenticated but no active org for org-required routes → redirect to /org-required
  // This catches users who signed in but haven't created/joined an organization yet.
  if (requiresOrg(req) && !orgId) {
    const orgRequiredUrl = new URL("/org-required", req.url);
    orgRequiredUrl.searchParams.set("return_to", req.nextUrl.pathname);
    return NextResponse.redirect(orgRequiredUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Run middleware on all paths except Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

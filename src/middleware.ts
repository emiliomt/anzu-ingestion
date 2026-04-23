// Anzu Dynamics — Clerk Auth + Multi-Tenant Middleware
// Protects all routes; enforces org membership on admin/dashboard routes.
// Role-checking is done inside API handlers — middleware only ensures auth + org presence.
//
// Fallback path: when the Clerk JWT lacks orgId (Clerk domain not added to allowed-origins
// so setActive() can't refresh the token), the middleware queries Clerk's API directly,
// injects x-anzu-org-id + x-anzu-org-role headers, and lets the user through.
// tenant.ts + roles.ts read these headers as a fallback when auth().orgId is null.

import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
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
  "/api/v1/ingest",
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
  "/api/billing(.*)",
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

  // Org required but JWT has no orgId ──────────────────────────────────────────
  // This happens when Clerk's session token hasn't been refreshed with the org
  // (e.g. allowed-origins not configured for this domain in the Clerk dashboard).
  // Fix: query Clerk's API server-side for the user's memberships, inject the
  // org into trusted request headers so API routes can use it directly.
  if (requiresOrg(req) && !orgId) {
    try {
      const client = await clerkClient();
      const { data: memberships } = await client.users.getOrganizationMembershipList({
        userId,
        limit: 5,
      });

      if (memberships.length === 0) {
        // User genuinely has no org — send to creation flow
        const dest = new URL("/org-required", req.url);
        dest.searchParams.set("return_to", req.nextUrl.pathname);
        return NextResponse.redirect(dest);
      }

      // Inject the first (or only) org + role as trusted server-set headers.
      // Strip any client-supplied values first to prevent header injection.
      const reqHeaders = new Headers(req.headers);
      reqHeaders.delete("x-anzu-org-id");
      reqHeaders.delete("x-anzu-org-role");
      reqHeaders.set("x-anzu-org-id",   memberships[0].organization.id);
      reqHeaders.set("x-anzu-org-role",  memberships[0].role);
      return NextResponse.next({ request: { headers: reqHeaders } });
    } catch (err) {
      console.error("[middleware] org membership lookup failed:", err);
      // Fall through to org-required on API error
      const dest = new URL("/org-required", req.url);
      dest.searchParams.set("return_to", req.nextUrl.pathname);
      return NextResponse.redirect(dest);
    }
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

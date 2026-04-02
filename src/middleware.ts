/**
 * Anzu Dynamics — Next.js Edge Middleware
 * ─────────────────────────────────────────────────────────────────────────────
 * Enforces role-based access control at the routing layer using Clerk.
 *
 * Role → Portal mapping:
 *   ADMIN    → /admin/*      (full system access, all tenants)
 *   CLIENT   → /client/*     (org-scoped dashboard)
 *   PROVIDER → /provider/*   (restricted supplier portal)
 *   <none>   → /setup        (onboarding for new users)
 *
 * Rules:
 * - Public routes: accessible by anyone (no auth required)
 * - If a user tries to access a portal that doesn't match their role → redirect
 * - If authenticated but no role yet → redirect to /setup
 * - All other protected routes require valid Clerk session
 *
 * NOTE: Role is read from Clerk `publicMetadata.role` (fast, no DB round-trip).
 * It is set via Clerk's Backend SDK when the UserProfile is created/updated.
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// ── Public routes — no authentication needed ──────────────────────────────────
const isPublic = createRouteMatcher([
  "/",
  "/pricing(.*)",
  "/status(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/portal",            // legacy provider portal landing (unauthenticated upload)
  "/portal/sign-in(.*)",
  "/portal/sign-up(.*)",
  "/setup",             // role onboarding (must be accessible before profile exists)
  "/api/webhooks(.*)",     // SendGrid / Twilio webhooks (HMAC-signed separately)
  "/api/billing/webhook", // Stripe webhook (signature-verified internally)
  "/api/status(.*)",
  "/api/upload",        // unauthenticated invoice upload endpoint
  "/api/health",
]);

// ── Role-restricted portals ───────────────────────────────────────────────────
const isAdminRoute    = createRouteMatcher(["/admin(.*)"]);
const isClientRoute   = createRouteMatcher(["/client(.*)"]);
const isProviderRoute = createRouteMatcher(["/provider(.*)"]);

// ── Routes that require any valid session (role doesn't matter) ───────────────
const isProtected = createRouteMatcher([
  "/admin(.*)",
  "/client(.*)",
  "/provider(.*)",
  "/dashboard(.*)",
  "/api/auth(.*)",
  "/api/admin(.*)",
  "/api/client(.*)",
  "/api/provider(.*)",
  "/api/invoices(.*)",
  "/api/projects(.*)",
  "/api/purchase-orders(.*)",
  "/api/matching(.*)",
  "/api/export(.*)",
  "/api/training(.*)",
  "/api/fine-tune(.*)",
  "/api/metrics(.*)",
  "/api/settings(.*)",
  "/api/custom-fields(.*)",
  "/api/erp-profiles(.*)",
  "/api/caja-chica(.*)",
  "/api/preaccounting(.*)",
  "/api/security(.*)",
  "/api/files(.*)",
  "/api/portal(.*)",
  "/matcher(.*)",
  "/preaccounting(.*)",
  "/security(.*)",
]);

export default clerkMiddleware((auth, req) => {
  const { pathname } = req.nextUrl;

  // Always allow public routes
  if (isPublic(req)) return;

  // Get auth state (fast — reads from JWT, no DB)
  const { userId, sessionClaims } = auth();

  // ── Not signed in → redirect to sign-in ──────────────────────────────────
  if (!userId && isProtected(req)) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (!userId) return; // non-protected route, allow through

  // ── Extract role from Clerk JWT (publicMetadata) ──────────────────────────
  // This avoids a DB round-trip at the middleware layer (runs on Edge).
  const meta = (sessionClaims as { publicMetadata?: { role?: string } } | null)
    ?.publicMetadata;
  const role = meta?.role as "ADMIN" | "CLIENT" | "PROVIDER" | undefined;

  // ── No role assigned yet → redirect to setup (unless already there) ───────
  if (!role && !pathname.startsWith("/setup") && !pathname.startsWith("/api")) {
    return NextResponse.redirect(new URL("/setup", req.url));
  }

  // ── Role-based portal enforcement ─────────────────────────────────────────
  // Prevent cross-portal access: e.g. PROVIDER trying to access /admin

  if (isAdminRoute(req) && role !== "ADMIN") {
    // Block non-admins from /admin/* completely
    const home = getRoleHome(role);
    return NextResponse.redirect(new URL(home, req.url));
  }

  if (isClientRoute(req) && role !== "CLIENT" && role !== "ADMIN") {
    // ADMIN can impersonate/view client areas; others cannot
    const home = getRoleHome(role);
    return NextResponse.redirect(new URL(home, req.url));
  }

  if (isProviderRoute(req) && role !== "PROVIDER" && role !== "ADMIN") {
    // Block non-providers/non-admins from /provider/*
    const home = getRoleHome(role);
    return NextResponse.redirect(new URL(home, req.url));
  }

  // ── API route enforcement: AI/training endpoints (ADMIN only) ────────────
  if (pathname.startsWith("/api/training") || pathname.startsWith("/api/fine-tune")) {
    if (role !== "ADMIN") {
      return NextResponse.json(
        { error: "Admin access required for AI model endpoints" },
        { status: 403 }
      );
    }
  }

  // ── API route enforcement: PROVIDER blocked from admin/client APIs ─────────
  if (role === "PROVIDER") {
    const blockedPrefixes = [
      "/api/admin",
      "/api/client",
      "/api/training",
      "/api/fine-tune",
      "/api/projects",
      "/api/purchase-orders",
      "/api/matching",
      "/api/export",
      "/api/metrics",
      "/api/erp-profiles",
      "/api/caja-chica",
      "/api/preaccounting",
      "/api/custom-fields",
      "/api/settings",
    ];
    if (blockedPrefixes.some((p) => pathname.startsWith(p))) {
      return NextResponse.json(
        { error: "Providers do not have access to this resource" },
        { status: 403 }
      );
    }
  }

  // All checks passed — allow the request through
});

export const config = {
  matcher: [
    // Match all paths except Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

// ── Helper: role → home route ─────────────────────────────────────────────────
function getRoleHome(role: string | undefined): string {
  switch (role) {
    case "ADMIN":    return "/admin";
    case "CLIENT":   return "/client";
    case "PROVIDER": return "/provider";
    default:         return "/setup";
  }
}

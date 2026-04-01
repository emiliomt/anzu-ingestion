/**
 * GET /api/auth/me
 * ─────────────────────────────────────────────────────────────────────────────
 * Returns the current user's full profile, organization details, and
 * their effective permissions. Used by client-side code to build UIs.
 */

import { NextResponse } from "next/server";
import { getSessionContext, unauthorized } from "@/lib/auth";
import { PERMISSIONS, PLAN_FEATURES, type UserRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();

  // Build effective permissions for this user's role
  const effectivePermissions = Object.entries(PERMISSIONS)
    .filter(([, roles]) => (roles as readonly UserRole[]).includes(ctx.role))
    .map(([key]) => key);

  // Build plan features for CLIENT users
  let planFeatures: string[] = [];
  if (ctx.role === "CLIENT" && ctx.organization) {
    const plan = ctx.organization.plan as keyof typeof PLAN_FEATURES;
    planFeatures = Array.from(PLAN_FEATURES[plan] ?? []);
  }

  return NextResponse.json({
    user: {
      clerkUserId: ctx.clerkUserId,
      role: ctx.role,
      email: ctx.userProfile.email,
      firstName: ctx.userProfile.firstName,
      lastName: ctx.userProfile.lastName,
    },
    organization: ctx.organization
      ? {
          id: ctx.organization.id,
          slug: ctx.organization.slug,
          name: ctx.organization.name,
          plan: ctx.organization.plan,
          country: ctx.organization.country,
        }
      : null,
    permissions: effectivePermissions,
    planFeatures,
  });
}

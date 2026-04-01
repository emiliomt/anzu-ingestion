/**
 * POST /api/auth/setup-profile
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates (or updates) the UserProfile in the database after a user signs up
 * via Clerk. Also updates the user's publicMetadata.role in Clerk so that
 * the middleware can read it from the JWT without a DB round-trip.
 *
 * Called from: /setup page after user chooses their role.
 *
 * Body (JSON):
 *   { role: "CLIENT" | "PROVIDER", organizationSlug?: string (for CLIENT) }
 *
 * For CLIENT: organizationSlug must refer to an existing Organization that
 *   was pre-created by an ADMIN. The user becomes a member of that org.
 * For PROVIDER: no org needed. They connect to orgs via invitations.
 * For ADMIN: roles cannot be self-assigned — use PATCH /api/admin/users/[clerkId]/role
 */

import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const SetupSchema = z.object({
  role: z.enum(["CLIENT", "PROVIDER"]),
  organizationSlug: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SetupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { role, organizationSlug } = parsed.data;

  // ── Resolve organization for CLIENT role ──────────────────────────────────
  let organizationId: string | null = null;

  if (role === "CLIENT") {
    if (!organizationSlug) {
      return NextResponse.json(
        { error: "organizationSlug is required for CLIENT role" },
        { status: 400 }
      );
    }

    const org = await prisma.organization.findUnique({
      where: { slug: organizationSlug },
    });

    if (!org) {
      return NextResponse.json(
        { error: `Organization '${organizationSlug}' not found` },
        { status: 404 }
      );
    }

    if (!org.isActive) {
      return NextResponse.json(
        { error: "This organization account is currently inactive" },
        { status: 403 }
      );
    }

    organizationId = org.id;
  }

  // ── Fetch Clerk user details ──────────────────────────────────────────────
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? null;
  const firstName = clerkUser?.firstName ?? null;
  const lastName = clerkUser?.lastName ?? null;

  // ── Upsert UserProfile ────────────────────────────────────────────────────
  const profile = await prisma.userProfile.upsert({
    where: { clerkUserId: userId },
    update: {
      role,
      organizationId,
      email,
      firstName,
      lastName,
      isActive: true,
    },
    create: {
      clerkUserId: userId,
      role,
      organizationId,
      email,
      firstName,
      lastName,
      isActive: true,
    },
  });

  // ── Sync role to Clerk publicMetadata ─────────────────────────────────────
  // This is what the middleware reads from the JWT — must stay in sync with DB.
  try {
    await clerkClient().users.updateUserMetadata(userId, {
      publicMetadata: { role },
    });
  } catch (err) {
    console.error("[setup-profile] Failed to update Clerk metadata:", err);
    // Non-fatal: profile is in DB; user may need to re-login for middleware to pick up role
  }

  return NextResponse.json({
    success: true,
    profile: {
      id: profile.id,
      role: profile.role,
      organizationId: profile.organizationId,
    },
  });
}

/**
 * GET /api/auth/setup-profile
 * Check if the current user already has a profile (to skip onboarding).
 */
export async function GET() {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { clerkUserId: userId },
    select: { role: true, organizationId: true },
  });

  return NextResponse.json({ profile });
}

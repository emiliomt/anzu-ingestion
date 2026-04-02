/**
 * POST /api/auth/setup-profile
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates (or updates) the UserProfile after Clerk sign-up. Also updates
 * Clerk publicMetadata.role so the middleware can read it from the JWT.
 *
 * CLIENT path A (self-signup):  { role, orgName, country, plan }
 *   → auto-creates Organization + UserProfile
 * CLIENT path B (admin-invited): { role, organizationSlug }
 *   → joins existing Organization
 * PROVIDER: { role: "PROVIDER" }
 *   → creates UserProfile with no org (connects via invitations)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** Convert any string to a URL-safe slug */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);
}

const SetupSchema = z.union([
  // CLIENT self-signup — creates new org
  z.object({
    role: z.literal("CLIENT"),
    orgName: z.string().min(2).max(100),
    country: z.string().length(2).default("CO"),
    plan: z.enum(["Starter", "Growth", "Enterprise"]).default("Growth"),
  }),
  // CLIENT invited — joins existing org by slug
  z.object({
    role: z.literal("CLIENT"),
    organizationSlug: z.string(),
  }),
  // PROVIDER — no org
  z.object({
    role: z.literal("PROVIDER"),
  }),
]);

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SetupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const data = parsed.data;

  // ── Fetch Clerk user details ──────────────────────────────────────────────
  const clerkUser = await currentUser();
  const email     = clerkUser?.emailAddresses?.[0]?.emailAddress ?? null;
  const firstName = clerkUser?.firstName ?? null;
  const lastName  = clerkUser?.lastName ?? null;

  // ── Resolve / create Organization ────────────────────────────────────────
  let organizationId: string | null = null;

  if (data.role === "CLIENT") {
    if ("orgName" in data) {
      // Self-signup: create a new organization
      let slug = slugify(data.orgName);

      // Ensure slug uniqueness by appending a short random suffix if taken
      const existingSlug = await prisma.organization.findUnique({ where: { slug } });
      if (existingSlug) {
        slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      }

      const org = await prisma.organization.create({
        data: {
          slug,
          name: data.orgName,
          country: data.country,
          plan: data.plan,
        },
      });
      organizationId = org.id;
    } else {
      // Admin-invited: join existing org by slug
      const org = await prisma.organization.findUnique({
        where: { slug: data.organizationSlug },
      });
      if (!org) {
        return NextResponse.json(
          { error: `Organization '${data.organizationSlug}' not found` },
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
  }

  // ── Upsert UserProfile ────────────────────────────────────────────────────
  const profile = await prisma.userProfile.upsert({
    where:  { clerkUserId: userId },
    update: { role: data.role, organizationId, email, firstName, lastName, isActive: true },
    create: { clerkUserId: userId, role: data.role, organizationId, email, firstName, lastName, isActive: true },
  });

  // ── Sync role to Clerk publicMetadata ─────────────────────────────────────
  try {
    await clerkClient().users.updateUserMetadata(userId, {
      publicMetadata: { role: data.role },
    });
  } catch (err) {
    console.error("[setup-profile] Failed to update Clerk metadata:", err);
  }

  return NextResponse.json({
    success: true,
    profile: { id: profile.id, role: profile.role, organizationId: profile.organizationId },
  });
}

/** GET /api/auth/setup-profile — check if current user already has a profile */
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

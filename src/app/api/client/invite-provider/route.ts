/**
 * POST /api/client/invite-provider — Invite a provider to connect (CLIENT only)
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates a ProviderOrganizationConnection with status "pending".
 * The provider must accept the invitation via POST /api/provider/accept-invite.
 *
 * Body: { providerEmail: string }
 *
 * The provider must already have a UserProfile with role=PROVIDER.
 * (They need to sign up and complete onboarding first.)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientOrAdmin } from "@/lib/api-guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

const InviteSchema = z.object({
  providerEmail: z.string().email(),
});

export const POST = clientOrAdmin(async (req: NextRequest, ctx) => {
  const orgId = ctx.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: "No organization context" }, { status: 400 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  // Find the provider's UserProfile by email
  const providerProfile = await prisma.userProfile.findFirst({
    where: { email: parsed.data.providerEmail, role: "PROVIDER", isActive: true },
  });

  if (!providerProfile) {
    return NextResponse.json(
      { error: "No active provider account found with that email address. They must sign up as a provider first." },
      { status: 404 }
    );
  }

  // Check for existing connection
  const existing = await prisma.providerOrganizationConnection.findUnique({
    where: {
      providerProfileId_organizationId: {
        providerProfileId: providerProfile.id,
        organizationId: orgId,
      },
    },
  });

  if (existing) {
    if (existing.status === "accepted") {
      return NextResponse.json({ error: "This provider is already connected to your organization" }, { status: 409 });
    }
    if (existing.status === "pending") {
      return NextResponse.json({ error: "An invitation is already pending for this provider" }, { status: 409 });
    }
    // If rejected, allow re-inviting by updating to pending
    const updated = await prisma.providerOrganizationConnection.update({
      where: { id: existing.id },
      data: {
        status: "pending",
        invitedAt: new Date(),
        invitedByClerkUserId: ctx.clerkUserId,
        acceptedAt: null,
      },
    });
    return NextResponse.json({ connection: updated }, { status: 200 });
  }

  // Create new connection
  const connection = await prisma.providerOrganizationConnection.create({
    data: {
      providerProfileId: providerProfile.id,
      organizationId: orgId,
      status: "pending",
      invitedByClerkUserId: ctx.clerkUserId,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      actorClerkUserId: ctx.clerkUserId,
      actorRole: ctx.role,
      action: "provider.invite",
      resourceType: "ProviderOrganizationConnection",
      resourceId: connection.id,
      organizationId: orgId,
      metadata: JSON.stringify({ providerEmail: parsed.data.providerEmail }),
    },
  });

  return NextResponse.json({ connection }, { status: 201 });
}, "provider.invite");

/**
 * POST /api/provider/accept-invite — Accept a pending client invitation (PROVIDER only)
 * ─────────────────────────────────────────────────────────────────────────────
 * Body: { connectionId: string }
 *
 * After accepting, the Client's Organization will appear in the provider's
 * upload dropdown (GET /api/provider/my-clients).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { providerOnly } from "@/lib/api-guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

const AcceptSchema = z.object({
  connectionId: z.string().uuid(),
});

export const POST = providerOnly(async (req: NextRequest, ctx) => {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = AcceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { clerkUserId: ctx.clerkUserId },
  });

  if (!profile) {
    return NextResponse.json({ error: "Provider profile not found" }, { status: 404 });
  }

  // Find the connection and verify it belongs to this provider
  const connection = await prisma.providerOrganizationConnection.findUnique({
    where: { id: parsed.data.connectionId },
    include: { organization: { select: { name: true } } },
  });

  if (!connection) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  if (connection.providerProfileId !== profile.id) {
    return NextResponse.json({ error: "This invitation is not for your account" }, { status: 403 });
  }

  if (connection.status !== "pending") {
    return NextResponse.json(
      { error: `Invitation is already in status: ${connection.status}` },
      { status: 409 }
    );
  }

  const updated = await prisma.providerOrganizationConnection.update({
    where: { id: connection.id },
    data: {
      status: "accepted",
      acceptedAt: new Date(),
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      actorClerkUserId: ctx.clerkUserId,
      actorRole: ctx.role,
      action: "provider.accept_invite",
      resourceType: "ProviderOrganizationConnection",
      resourceId: connection.id,
      organizationId: connection.organizationId,
      metadata: JSON.stringify({ organizationName: connection.organization.name }),
    },
  });

  return NextResponse.json({
    success: true,
    connection: updated,
    message: `You are now connected to ${connection.organization.name}`,
  });
});

/**
 * GET /api/provider/connections — All connections for this provider (pending + accepted + rejected)
 * ─────────────────────────────────────────────────────────────────────────────
 * Used by the /provider/connections page to show all invitations and their statuses.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { providerOnly } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

export const GET = providerOnly(async (_req, ctx) => {
  const profile = await prisma.userProfile.findUnique({
    where: { clerkUserId: ctx.clerkUserId },
  });

  if (!profile) {
    return NextResponse.json({ error: "Provider profile not found" }, { status: 404 });
  }

  const connections = await prisma.providerOrganizationConnection.findMany({
    where: { providerProfileId: profile.id },
    orderBy: { invitedAt: "desc" },
    include: {
      organization: {
        select: { id: true, slug: true, name: true, plan: true, country: true },
      },
    },
  });

  return NextResponse.json({ connections });
});

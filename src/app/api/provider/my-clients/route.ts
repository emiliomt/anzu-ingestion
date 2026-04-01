/**
 * GET /api/provider/my-clients — List accepted client organizations (PROVIDER only)
 * ─────────────────────────────────────────────────────────────────────────────
 * Used to populate the Client Selector dropdown in the provider upload form.
 * Returns only organizations where the connection status is "accepted".
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
    where: {
      providerProfileId: profile.id,
      status: "accepted",
    },
    include: {
      organization: {
        select: {
          id: true,
          slug: true,
          name: true,
          plan: true,
          country: true,
        },
      },
    },
    orderBy: { acceptedAt: "desc" },
  });

  const clients = connections.map((c) => c.organization);

  return NextResponse.json({ clients });
});

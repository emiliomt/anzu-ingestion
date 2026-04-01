/**
 * GET /api/client/providers — List providers connected to this org (CLIENT + ADMIN)
 * ─────────────────────────────────────────────────────────────────────────────
 * Query params:
 *   status?: "pending" | "accepted" | "rejected" (default: all)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientOrAdmin } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

export const GET = clientOrAdmin(async (req: NextRequest, ctx) => {
  const orgId = ctx.organizationId;
  if (!orgId && ctx.role !== "ADMIN") {
    return NextResponse.json({ error: "No organization context" }, { status: 400 });
  }

  const status = new URL(req.url).searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (orgId) where.organizationId = orgId;
  if (status) where.status = status;

  const connections = await prisma.providerOrganizationConnection.findMany({
    where,
    orderBy: { invitedAt: "desc" },
    include: {
      providerProfile: {
        select: { id: true, email: true, firstName: true, lastName: true, clerkUserId: true },
      },
    },
  });

  return NextResponse.json({ connections });
});

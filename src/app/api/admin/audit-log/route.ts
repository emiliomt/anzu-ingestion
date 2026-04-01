/**
 * GET /api/admin/audit-log — Paginated audit log (ADMIN only)
 * ─────────────────────────────────────────────────────────────────────────────
 * Query params:
 *   page, limit, organizationId, actorClerkUserId, action, resourceType
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminOnly } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

export const GET = adminOnly(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);

  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")));
  const skip  = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  const orgId       = searchParams.get("organizationId");
  const actorId     = searchParams.get("actorClerkUserId");
  const action      = searchParams.get("action");
  const resourceType = searchParams.get("resourceType");

  if (orgId)        where.organizationId    = orgId;
  if (actorId)      where.actorClerkUserId  = actorId;
  if (action)       where.action            = { contains: action };
  if (resourceType) where.resourceType      = resourceType;

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        organization: { select: { name: true, slug: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    entries,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}, "audit_log.view");

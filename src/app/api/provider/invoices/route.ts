/**
 * GET /api/provider/invoices — Provider's own submitted invoices (PROVIDER only)
 * ─────────────────────────────────────────────────────────────────────────────
 * Providers can only see invoices they personally submitted (by email).
 * They cannot see other providers' invoices or cross-tenant data.
 *
 * Query params: page, limit, status, organizationId (filter by specific client)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { providerOnly } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

export const GET = providerOnly(async (req: NextRequest, ctx) => {
  const { searchParams } = new URL(req.url);

  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "25")));
  const skip  = (page - 1) * limit;
  const status = searchParams.get("status");
  const orgId  = searchParams.get("organizationId");

  // Providers can only see invoices submitted by their email address
  const providerEmail = ctx.userProfile.email;
  if (!providerEmail) {
    return NextResponse.json({ error: "Provider email not configured" }, { status: 400 });
  }

  // If filtering by org, validate that the provider has access to that org
  if (orgId) {
    const profile = await prisma.userProfile.findUnique({ where: { clerkUserId: ctx.clerkUserId } });
    if (profile) {
      const conn = await prisma.providerOrganizationConnection.findFirst({
        where: { providerProfileId: profile.id, organizationId: orgId, status: "accepted" },
      });
      if (!conn) {
        return NextResponse.json({ error: "You are not connected to this organization" }, { status: 403 });
      }
    }
  }

  const where: Record<string, unknown> = {
    submittedBy: providerEmail,
  };
  if (status) where.status = status;
  if (orgId)  where.organizationId = orgId;

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true, referenceNo: true, status: true, channel: true,
        fileName: true, submittedAt: true, processedAt: true,
        organizationId: true,
        organization: { select: { name: true } },
        extractedData: {
          where: { fieldName: { in: ["invoice_number", "vendor_name", "total", "issue_date"] } },
          select: { fieldName: true, value: true },
        },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  return NextResponse.json({
    invoices,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

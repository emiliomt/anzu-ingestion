import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/utils";
import { withPlanFeature } from "@/lib/plan-guard";

export const dynamic = "force-dynamic";

async function _GET(_req: NextRequest) {
  const [securityFailed, allChecked, recentAll] = await Promise.all([
    // Invoices that failed the security check
    prisma.invoice.findMany({
      where: { flags: { contains: "security_failed" } },
      orderBy: { submittedAt: "desc" },
      take: 100,
      select: {
        id: true, referenceNo: true, channel: true, status: true,
        submittedAt: true, processedAt: true, flags: true,
        vendor: { select: { name: true } },
        extractedData: {
          where: { fieldName: { in: ["vendor_tax_id", "buyer_name", "buyer_tax_id", "total", "currency"] } },
          select: { fieldName: true, value: true, confidence: true },
        },
      },
    }),

    // Total invoices that went through security (had any flag check performed)
    prisma.invoice.count({
      where: { status: { in: ["extracted", "reviewed", "complete", "error"] } },
    }),

    // Recent 20 invoices that were processed (for pass/fail audit table)
    prisma.invoice.findMany({
      where: { status: { in: ["extracted", "reviewed", "complete"] } },
      orderBy: { processedAt: "desc" },
      take: 20,
      select: {
        id: true, referenceNo: true, channel: true, status: true,
        submittedAt: true, processedAt: true, flags: true,
        vendor: { select: { name: true } },
        extractedData: {
          where: { fieldName: { in: ["vendor_tax_id", "buyer_name", "total", "currency"] } },
          select: { fieldName: true, value: true },
        },
      },
    }),
  ]);

  const failed  = securityFailed.length;
  const passed  = Math.max(0, allChecked - failed);
  const passRate = allChecked > 0 ? Math.round((passed / allChecked) * 100) : 100;

  const mapFields = (rows: { fieldName: string; value: string | null }[]) =>
    Object.fromEntries(rows.map((r) => [r.fieldName, r.value]));

  return NextResponse.json({
    stats: { failed, passed, total: allChecked, passRate },
    failedInvoices: securityFailed.map((inv) => ({
      id: inv.id,
      referenceNo: inv.referenceNo,
      channel: inv.channel,
      status: inv.status,
      submittedAt: inv.submittedAt,
      vendorName: inv.vendor?.name ?? null,
      flags: safeJsonParse<string[]>(inv.flags, []),
      fields: mapFields(inv.extractedData),
    })),
    recentChecks: recentAll.map((inv) => ({
      id: inv.id,
      referenceNo: inv.referenceNo,
      channel: inv.channel,
      status: inv.status,
      processedAt: inv.processedAt,
      vendorName: inv.vendor?.name ?? null,
      flags: safeJsonParse<string[]>(inv.flags, []),
      passed: !safeJsonParse<string[]>(inv.flags, []).includes("security_failed"),
      fields: mapFields(inv.extractedData),
    })),
  });
}

export const GET = withPlanFeature("security", _GET);

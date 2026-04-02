import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withPlanFeature } from "@/lib/plan-guard";

const ACCOUNT_CODES: Record<string, { code: string; label: string }> = {
  material:  { code: "5100", label: "Materials & Supplies" },
  labor:     { code: "5200", label: "Labor & Services" },
  equipment: { code: "5300", label: "Equipment & Machinery" },
  freight:   { code: "5400", label: "Freight & Logistics" },
  overhead:  { code: "5500", label: "Overhead & Utilities" },
  tax:       { code: "5600", label: "Taxes & Duties" },
  discount:  { code: "5700", label: "Discounts" },
  other:     { code: "5800", label: "Other Expenses" },
};

function getDateFrom(period: string): Date | undefined {
  const now = new Date();
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    return new Date(now.getFullYear(), q * 3, 1);
  }
  if (period === "ytd") return new Date(now.getFullYear(), 0, 1);
  return undefined; // "all"
}

async function _GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const period = searchParams.get("period") ?? "ytd";
  const projectId = searchParams.get("projectId") ?? undefined;
  const matchTypeFilter = searchParams.get("matchType") ?? undefined;

  const dateFrom = getDateFrom(period);

  const matches = await prisma.invoiceMatch.findMany({
    where: {
      isConfirmed: true,
      ...(projectId ? { projectId } : {}),
      ...(matchTypeFilter ? { matchType: matchTypeFilter } : {}),
      invoice: {
        submittedAt: dateFrom ? { gte: dateFrom } : undefined,
      },
    },
    include: {
      invoice: {
        include: {
          lineItems: true,
          extractedData: {
            where: { fieldName: { in: ["vendor_name", "invoice_total", "currency", "invoice_date", "total"] } },
          },
        },
      },
      project: { select: { id: true, name: true, code: true } },
      purchaseOrder: { select: { id: true, poNumber: true, description: true } },
      cajaChica: { select: { id: true, name: true, period: true } },
    },
  });

  // Aggregation buckets
  type CategoryBucket = { total: number; count: number; invoiceIds: Set<string> };
  const byCategory: Record<string, CategoryBucket> = {};
  type ProjectBucket = { name: string; total: number; byCategory: Record<string, number>; invoiceIds: Set<string> };
  const byProject: Record<string, ProjectBucket> = {};
  const byMonth: Record<string, { total: number; byCategory: Record<string, number> }> = {};
  type VendorBucket = { total: number; invoiceCount: number };
  const byVendor: Record<string, VendorBucket> = {};
  let cajaChicaTotal = 0;
  let regularTotal = 0;

  const seenInvoices = new Set<string>();

  for (const match of matches) {
    const { invoice, matchType } = match;
    const isCajaChica = matchType === "caja_chica";
    const month = invoice.submittedAt.toISOString().slice(0, 7);

    if (!byMonth[month]) byMonth[month] = { total: 0, byCategory: {} };

    const invoiceTotalField =
      invoice.extractedData.find((f) => f.fieldName === "total") ??
      invoice.extractedData.find((f) => f.fieldName === "invoice_total");
    const fallbackTotal = parseFloat(invoiceTotalField?.value ?? "0") || 0;

    // Vendor aggregation
    const vendorName =
      invoice.extractedData.find((f) => f.fieldName === "vendor_name")?.value?.trim() || "Unknown Vendor";
    if (!byVendor[vendorName]) byVendor[vendorName] = { total: 0, invoiceCount: 0 };
    if (!seenInvoices.has(invoice.id)) {
      byVendor[vendorName].total += fallbackTotal;
      byVendor[vendorName].invoiceCount++;
    }

    const lineItems = invoice.lineItems.length > 0
      ? invoice.lineItems
      : [{ category: "other", lineTotal: fallbackTotal }];

    for (const li of lineItems) {
      const cat = li.category ?? "other";
      const amount = li.lineTotal ?? 0;

      if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0, invoiceIds: new Set() };
      byCategory[cat].total += amount;
      byCategory[cat].count++;
      byCategory[cat].invoiceIds.add(invoice.id);

      byMonth[month].total += amount;
      byMonth[month].byCategory[cat] = (byMonth[month].byCategory[cat] ?? 0) + amount;

      if (isCajaChica) cajaChicaTotal += amount;
      else regularTotal += amount;
    }

    // By project
    if (match.project) {
      const pid = match.project.id;
      if (!byProject[pid]) byProject[pid] = { name: match.project.name, total: 0, byCategory: {}, invoiceIds: new Set() };
      for (const li of lineItems) {
        const cat = li.category ?? "other";
        const amount = li.lineTotal ?? 0;
        byProject[pid].total += amount;
        byProject[pid].byCategory[cat] = (byProject[pid].byCategory[cat] ?? 0) + amount;
        byProject[pid].invoiceIds.add(invoice.id);
      }
    }

    seenInvoices.add(invoice.id);
  }

  const categorySummary = Object.entries(byCategory)
    .map(([cat, data]) => ({
      category: cat,
      accountCode: ACCOUNT_CODES[cat]?.code ?? "5800",
      accountLabel: ACCOUNT_CODES[cat]?.label ?? "Other Expenses",
      total: data.total,
      lineItemCount: data.count,
      invoiceCount: data.invoiceIds.size,
    }))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  const projectSummary = Object.entries(byProject)
    .map(([id, data]) => ({
      projectId: id,
      projectName: data.name,
      total: data.total,
      invoiceCount: data.invoiceIds.size,
      byCategory: data.byCategory,
    }))
    .sort((a, b) => b.total - a.total);

  const monthSummary = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }));

  const vendorSummary = Object.entries(byVendor)
    .map(([vendorName, data]) => ({ vendorName, total: data.total, invoiceCount: data.invoiceCount }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return NextResponse.json({
    period,
    totals: {
      regular: regularTotal,
      cajaChica: cajaChicaTotal,
      grand: regularTotal + cajaChicaTotal,
    },
    byCategory: categorySummary,
    byProject: projectSummary,
    byMonth: monthSummary,
    byVendor: vendorSummary,
    invoiceCount: seenInvoices.size,
    matchCount: matches.length,
  });
}

export const GET = withPlanFeature("preaccounting", _GET);

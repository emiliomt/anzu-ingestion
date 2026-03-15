import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  return undefined;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));
  const category = searchParams.get("category") ?? undefined;
  const projectId = searchParams.get("projectId") ?? undefined;
  const matchTypeFilter = searchParams.get("matchType") ?? undefined;
  const period = searchParams.get("period") ?? "ytd";
  const dateFrom = getDateFrom(period);

  // Base filter: only approved matched invoices
  const invoiceWhere = {
    invoiceMatches: {
      some: {
        approvalStatus: "approved",
        ...(projectId ? { projectId } : {}),
        ...(matchTypeFilter ? { matchType: matchTypeFilter } : {}),
      },
    },
    submittedAt: dateFrom ? { gte: dateFrom } : undefined,
  };

  const [lineItems, total] = await Promise.all([
    prisma.lineItem.findMany({
      where: {
        ...(category ? { category } : {}),
        invoice: invoiceWhere,
      },
      include: {
        invoice: {
          include: {
            invoiceMatches: {
              where: { approvalStatus: "approved" },
              include: {
                project: { select: { id: true, name: true, code: true } },
                purchaseOrder: { select: { id: true, poNumber: true } },
                cajaChica: { select: { id: true, name: true } },
              },
            },
            extractedData: {
              where: { fieldName: { in: ["vendor_name", "invoice_date", "currency"] } },
            },
          },
        },
      },
      orderBy: { invoice: { submittedAt: "desc" } },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.lineItem.count({
      where: {
        ...(category ? { category } : {}),
        invoice: invoiceWhere,
      },
    }),
  ]);

  const entries = lineItems.map((li) => {
    const match = li.invoice.invoiceMatches[0];
    const vendorField = li.invoice.extractedData.find((f) => f.fieldName === "vendor_name");
    const dateField = li.invoice.extractedData.find((f) => f.fieldName === "invoice_date");
    const currencyField = li.invoice.extractedData.find((f) => f.fieldName === "currency");

    let matchLabel = "Unallocated";
    let matchType = match?.matchType ?? null;
    if (match?.project) matchLabel = match.project.name;
    else if (match?.purchaseOrder) matchLabel = `PO ${match.purchaseOrder.poNumber}`;
    else if (match?.cajaChica) matchLabel = match.cajaChica.name;

    const cat = li.category ?? "other";
    return {
      id: li.id,
      invoiceId: li.invoice.id,
      referenceNo: li.invoice.referenceNo,
      invoiceDate: dateField?.value ?? li.invoice.submittedAt.toISOString().slice(0, 10),
      vendorName: vendorField?.value ?? li.invoice.submittedName ?? "Unknown",
      description: li.description ?? "—",
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      amount: li.lineTotal ?? 0,
      currency: currencyField?.value ?? "COP",
      category: cat,
      accountCode: ACCOUNT_CODES[cat]?.code ?? "5800",
      accountLabel: ACCOUNT_CODES[cat]?.label ?? "Other Expenses",
      matchType,
      matchLabel,
      projectId: match?.projectId ?? null,
    };
  });

  return NextResponse.json({
    entries,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

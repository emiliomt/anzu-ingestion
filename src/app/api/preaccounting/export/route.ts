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

function esc(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const period = searchParams.get("period") ?? "ytd";
  const projectId = searchParams.get("projectId") ?? undefined;

  const now = new Date();
  let dateFrom: Date | undefined;
  if (period === "month") dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    dateFrom = new Date(now.getFullYear(), q * 3, 1);
  } else if (period === "ytd") dateFrom = new Date(now.getFullYear(), 0, 1);

  const matches = await prisma.invoiceMatch.findMany({
    where: {
      isConfirmed: true,
      ...(projectId ? { projectId } : {}),
      invoice: { submittedAt: dateFrom ? { gte: dateFrom } : undefined },
    },
    include: {
      invoice: {
        include: {
          lineItems: true,
          extractedData: {
            where: { fieldName: { in: ["vendor_name", "invoice_date", "invoice_total", "currency"] } },
          },
        },
      },
      project: { select: { name: true, code: true } },
      purchaseOrder: { select: { poNumber: true } },
      cajaChica: { select: { name: true } },
    },
  });

  const headers = [
    "Reference No", "Invoice Date", "Vendor", "Description",
    "Quantity", "Unit Price", "Amount", "Currency",
    "Account Code", "Account Label", "Category",
    "Match Type", "Project / PO / Caja Chica",
  ];

  const rows: string[] = [headers.map(esc).join(",")];

  for (const match of matches) {
    const { invoice } = match;
    const vendorField = invoice.extractedData.find((f) => f.fieldName === "vendor_name");
    const dateField = invoice.extractedData.find((f) => f.fieldName === "invoice_date");
    const currencyField = invoice.extractedData.find((f) => f.fieldName === "currency");
    const totalField = invoice.extractedData.find((f) => f.fieldName === "invoice_total");

    const vendor = vendorField?.value ?? invoice.submittedName ?? "Unknown";
    const invDate = dateField?.value ?? invoice.submittedAt.toISOString().slice(0, 10);
    const currency = currencyField?.value ?? "COP";

    let matchLabel = "Unallocated";
    if (match.project) matchLabel = `${match.project.code ? match.project.code + " - " : ""}${match.project.name}`;
    else if (match.purchaseOrder) matchLabel = `PO ${match.purchaseOrder.poNumber}`;
    else if (match.cajaChica) matchLabel = match.cajaChica.name;

    const lineItems = invoice.lineItems.length > 0
      ? invoice.lineItems
      : [{ description: "Invoice total (no line items)", quantity: null, unitPrice: null, lineTotal: parseFloat(totalField?.value ?? "0") || 0, category: "other" }];

    for (const li of lineItems) {
      const cat = li.category ?? "other";
      rows.push([
        invoice.referenceNo,
        invDate,
        vendor,
        li.description ?? "—",
        li.quantity ?? "",
        li.unitPrice ?? "",
        li.lineTotal ?? 0,
        currency,
        ACCOUNT_CODES[cat]?.code ?? "5800",
        ACCOUNT_CODES[cat]?.label ?? "Other Expenses",
        cat,
        match.matchType,
        matchLabel,
      ].map(esc).join(","));
    }
  }

  const csv = rows.join("\r\n");
  const filename = `preaccounting-${period}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

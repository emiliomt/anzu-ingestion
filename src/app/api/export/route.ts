import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "";
  const channel = searchParams.get("channel") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (channel) where.channel = channel;
  if (from || to) {
    where.submittedAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    take: 10000,
    include: {
      vendor: { select: { name: true, address: true } },
      extractedData: {
        select: { fieldName: true, value: true, confidence: true, isVerified: true },
      },
    },
  });

  const fieldNames = [
    "vendor_name",
    "vendor_address",
    "invoice_number",
    "issue_date",
    "due_date",
    "subtotal",
    "tax",
    "total",
    "currency",
    "po_reference",
    "payment_terms",
  ];

  const headers = [
    "Reference No",
    "Channel",
    "Status",
    "Submitted At",
    "Submitted By",
    "File Name",
    "Duplicate",
    "Flags",
    ...fieldNames.map((f) => f.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())),
  ];

  const rows = invoices.map((inv) => {
    const fieldMap = new Map(inv.extractedData.map((f) => [f.fieldName, f.value]));
    const flags = safeJsonParse<string[]>(inv.flags, []).join("; ");

    return [
      inv.referenceNo,
      inv.channel,
      inv.status,
      inv.submittedAt.toISOString(),
      inv.submittedBy ?? "",
      inv.fileName,
      inv.isDuplicate ? "Yes" : "No",
      flags,
      ...fieldNames.map((f) => fieldMap.get(f) ?? ""),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
  });

  const csv = [headers.map((h) => `"${h}"`).join(","), ...rows.map((r) => r.join(","))].join(
    "\n"
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="anzuingestion-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

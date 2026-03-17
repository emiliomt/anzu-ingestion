import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export interface FineTuneListItem {
  id: string;
  referenceNo: string;
  vendorName: string | null;
  total: number | null;
  currency: string | null;
  hasOcrText: boolean;
  hasCorrectedData: boolean;
  updatedAt: string;
}

/**
 * GET /api/fine-tune/list
 *
 * Returns all invoices with fineTuneStatus = "READY", plus counts for
 * PENDING and UPLOADED so the UI can show a summary.
 */
export async function GET() {
  const [ready, pendingCount, uploadedCount] = await Promise.all([
    prisma.invoice.findMany({
      where: { fineTuneStatus: "READY" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        referenceNo: true,
        ocrText: true,
        correctedData: true,
        updatedAt: true,
        extractedData: {
          where: { fieldName: { in: ["vendor_name", "total", "currency"] } },
          select: { fieldName: true, value: true },
        },
      },
    }),
    prisma.invoice.count({ where: { fineTuneStatus: "PENDING" } }),
    prisma.invoice.count({ where: { fineTuneStatus: "UPLOADED" } }),
  ]);

  const items: FineTuneListItem[] = ready.map((inv) => {
    const fieldMap = Object.fromEntries(
      inv.extractedData.map((f) => [f.fieldName, f.value])
    );

    // If correctedData exists, prefer its values for vendor_name / total / currency
    let vendorName = fieldMap["vendor_name"] ?? null;
    let total: number | null = fieldMap["total"] ? Number(fieldMap["total"]) : null;
    let currency = fieldMap["currency"] ?? null;

    if (inv.correctedData) {
      try {
        const cd = JSON.parse(inv.correctedData) as Record<string, { value?: unknown }>;
        if (cd.vendor_name?.value) vendorName = String(cd.vendor_name.value);
        if (cd.total?.value != null) total = Number(cd.total.value);
        if (cd.currency?.value) currency = String(cd.currency.value);
      } catch {
        // correctedData malformed — fall back to extractedData values above
      }
    }

    return {
      id: inv.id,
      referenceNo: inv.referenceNo,
      vendorName,
      total: isNaN(total as number) ? null : total,
      currency,
      hasOcrText: !!inv.ocrText,
      hasCorrectedData: !!inv.correctedData,
      updatedAt: inv.updatedAt.toISOString(),
    };
  });

  return NextResponse.json({
    items,
    counts: {
      ready: items.length,
      pending: pendingCount,
      uploaded: uploadedCount,
    },
  });
}

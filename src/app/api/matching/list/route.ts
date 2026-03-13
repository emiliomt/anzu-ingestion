import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Returns invoices with their match status (for the matching dashboard)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") ?? "unmatched"; // unmatched | pending | confirmed | all

  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["extracted", "reviewed", "complete"] },
      ...(filter === "unmatched"
        ? { invoiceMatches: { none: {} } }
        : filter === "pending"
        ? { invoiceMatches: { some: { isConfirmed: false } } }
        : filter === "confirmed"
        ? { invoiceMatches: { some: { isConfirmed: true } } }
        : {}),
    },
    orderBy: { submittedAt: "desc" },
    take: 100,
    include: {
      vendor: { select: { name: true } },
      extractedData: {
        where: { fieldName: { in: ["total", "currency", "po_reference", "project_name", "vendor_name"] } },
      },
      invoiceMatches: {
        orderBy: { matchedAt: "desc" },
        take: 1,
        include: {
          project: { select: { name: true } },
          purchaseOrder: { select: { poNumber: true } },
          cajaChica: { select: { name: true } },
        },
      },
    },
  });

  return NextResponse.json(
    invoices.map((inv) => {
      const fields: Record<string, string> = {};
      for (const f of inv.extractedData) {
        if (f.value) fields[f.fieldName] = f.value;
      }
      const match = inv.invoiceMatches[0] ?? null;
      return {
        id: inv.id,
        referenceNo: inv.referenceNo,
        vendorName: fields["vendor_name"] ?? inv.vendor?.name ?? null,
        total: fields["total"] ?? null,
        currency: fields["currency"] ?? null,
        poReference: fields["po_reference"] ?? null,
        projectName: fields["project_name"] ?? null,
        submittedAt: inv.submittedAt.toISOString(),
        match: match
          ? {
              id: match.id,
              matchType: match.matchType,
              matchLabel:
                match.purchaseOrder?.poNumber ??
                match.project?.name ??
                match.cajaChica?.name ??
                "-",
              confidence: match.confidence,
              reasoning: match.reasoning,
              matchedBy: match.matchedBy,
              isConfirmed: match.isConfirmed,
              confirmedBy: match.confirmedBy,
            }
          : null,
      };
    })
  );
}

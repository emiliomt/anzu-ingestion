import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ref: string }> }
) {
  const { ref } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { referenceNo: ref },
    include: {
      vendor: { select: { name: true } },
      extractedData: {
        where: {
          fieldName: { in: ["total", "currency", "invoice_number", "issue_date"] },
        },
        select: { fieldName: true, value: true },
      },
      events: {
        orderBy: { timestamp: "asc" },
        select: { eventType: true, timestamp: true },
      },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Reference not found" }, { status: 404 });
  }

  const totalField = invoice.extractedData.find((f) => f.fieldName === "total");
  const currField = invoice.extractedData.find((f) => f.fieldName === "currency");
  const invNumField = invoice.extractedData.find(
    (f) => f.fieldName === "invoice_number"
  );

  // Parse once and guard against NaN — Claude may return non-numeric strings like "N/A"
  const totalNum = totalField?.value != null ? Number(totalField.value) : NaN;

  return NextResponse.json({
    referenceNo: invoice.referenceNo,
    status: invoice.status,
    channel: invoice.channel,
    vendorName: invoice.vendor?.name ?? null,
    invoiceNumber: invNumField?.value ?? null,
    totalAmount:
      !isNaN(totalNum) && currField?.value
        ? `${currField.value} ${totalNum.toFixed(2)}`
        : null,
    submittedAt: invoice.submittedAt.toISOString(),
    processedAt: invoice.processedAt?.toISOString() ?? null,
    flags: safeJsonParse<string[]>(invoice.flags, []),
    isDuplicate: invoice.isDuplicate,
    events: invoice.events.map((e) => ({
      type: e.eventType,
      timestamp: e.timestamp.toISOString(),
    })),
  });
}

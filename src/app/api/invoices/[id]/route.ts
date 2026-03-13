import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/utils";
import { getServeUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      vendor: true,
      extractedData: { orderBy: { fieldName: "asc" } },
      lineItems: true,
      events: { orderBy: { timestamp: "desc" } },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: invoice.id,
    referenceNo: invoice.referenceNo,
    channel: invoice.channel,
    status: invoice.status,
    fileName: invoice.fileName,
    mimeType: invoice.mimeType,
    fileSize: invoice.fileSize,
    fileUrl: getServeUrl(invoice.fileUrl),
    submittedBy: invoice.submittedBy,
    submittedName: invoice.submittedName,
    submittedAt: invoice.submittedAt.toISOString(),
    processedAt: invoice.processedAt?.toISOString() ?? null,
    reviewedBy: invoice.reviewedBy,
    isDuplicate: invoice.isDuplicate,
    duplicateOf: invoice.duplicateOf,
    flags: safeJsonParse<string[]>(invoice.flags, []),
    vendorName: invoice.vendor?.name ?? null,
    totalAmount: null, // computed below
    extractedData: invoice.extractedData.map((f) => ({
      id: f.id,
      fieldName: f.fieldName,
      value: f.value,
      confidence: f.confidence,
      isVerified: f.isVerified,
      isUncertain: f.isUncertain,
    })),
    lineItems: invoice.lineItems.map((li) => ({
      id: li.id,
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      lineTotal: li.lineTotal,
      category: li.category ?? null,
      confidence: li.confidence,
    })),
    events: invoice.events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      timestamp: e.timestamp.toISOString(),
      metadata: safeJsonParse(e.metadata ?? "{}", {}),
    })),
  });
}

/** Update a field value (inline edit from admin dashboard) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const body = await request.json() as {
    fieldId?: string;
    fieldName?: string;
    value?: string;
    status?: string;
    reviewedBy?: string;
  };

  // Update extracted field
  if (body.fieldId) {
    // Capture original value before overwriting (needed for training data)
    const existing = await prisma.extractedField.findUnique({
      where: { id: body.fieldId },
      select: { value: true },
    });
    const originalValue = existing?.value ?? null;

    await prisma.extractedField.update({
      where: { id: body.fieldId },
      data: {
        value: body.value,
        isVerified: true,
      },
    });

    // Log the correction for few-shot learning and fine-tuning
    if (originalValue !== body.value) {
      await prisma.correctionLog.create({
        data: {
          invoiceId: id,
          fieldName: body.fieldName ?? "unknown",
          originalValue,
          correctedValue: body.value ?? null,
          correctedBy: body.reviewedBy ?? "admin",
        },
      });
    }

    await prisma.ingestionEvent.create({
      data: {
        invoiceId: id,
        eventType: "field_updated",
        metadata: JSON.stringify({
          fieldId: body.fieldId,
          fieldName: body.fieldName,
          originalValue,
          newValue: body.value,
          updatedBy: body.reviewedBy ?? "admin",
        }),
      },
    });
  }

  // Update invoice status
  if (body.status) {
    const data: Record<string, unknown> = { status: body.status };
    if (body.reviewedBy) data.reviewedBy = body.reviewedBy;

    await prisma.invoice.update({ where: { id }, data });

    await prisma.ingestionEvent.create({
      data: {
        invoiceId: id,
        eventType: "status_changed",
        metadata: JSON.stringify({ status: body.status, by: body.reviewedBy }),
      },
    });
  }

  return NextResponse.json({ success: true });
}

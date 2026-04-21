import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAnyRole, RoleError } from "@/lib/roles";
import { readFile } from "@/lib/storage";
import { enqueueInvoice } from "@/lib/jobs/queues";
import { processInvoicePipeline } from "@/lib/jobs/process-invoice";

export const dynamic = "force-dynamic";

async function markInvoiceAsQueued(invoiceId: string) {
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "processing",
      processedAt: null,
      reviewedBy: null,
      flags: "[]",
      isDuplicate: false,
      duplicateOf: null,
    },
  });

  await Promise.all([
    prisma.extractedField.deleteMany({ where: { invoiceId } }),
    prisma.lineItem.deleteMany({ where: { invoiceId } }),
    prisma.ingestionEvent.create({
      data: {
        invoiceId,
        eventType: "reprocess_requested",
        metadata: JSON.stringify({ source: "admin_ui" }),
      },
    }),
  ]);
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await requireAnyRole();
    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        referenceNo: true,
        fileUrl: true,
        mimeType: true,
        submittedBy: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.organizationId && invoice.organizationId !== orgId) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    await markInvoiceAsQueued(invoice.id);

    if (invoice.organizationId) {
      try {
        await enqueueInvoice({
          invoiceId: invoice.id,
          organizationId: invoice.organizationId,
          fileUrl: invoice.fileUrl,
          mimeType: invoice.mimeType,
        });
        return NextResponse.json({ success: true, mode: "queued" });
      } catch (queueErr) {
        console.error(`[rerun] queue enqueue failed for ${invoice.id}, falling back inline`, queueErr);
      }
    }

    // Fallback inline reprocess for legacy invoices without organizationId
    const buffer = await readFile(invoice.fileUrl);
    processInvoicePipeline(
      invoice.id,
      invoice.referenceNo,
      buffer,
      invoice.mimeType,
      invoice.submittedBy,
      invoice.organizationId
    ).catch(async (err) => {
      console.error(`[rerun] inline processing failed for ${invoice.id}:`, err);
      try {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: "error", flags: JSON.stringify(["extraction_failed"]) },
        });
      } catch (updateErr) {
        console.error(`[rerun] failed to mark ${invoice.id} as error:`, updateErr);
      }
    });

    return NextResponse.json({ success: true, mode: "inline" });
  } catch (err) {
    if (err instanceof RoleError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[invoices rerun]", err);
    return NextResponse.json({ error: "Failed to re-run extraction" }, { status: 500 });
  }
}

// Anzu Dynamics — Invoice Processing Worker (BullMQ)
// Handles jobs from the "invoice-processing" queue.
// Pipeline: download file → OCR + AI extraction → store fields → update status.
//
// Runs as a standalone process via workers/index.ts (NOT inside Next.js runtime).
// Defaults to sequential processing to avoid OpenAI burst failures in large batches.

import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { prisma } from "../../prisma";
import { readFile } from "../../storage";
import { processInvoicePipeline } from "../process-invoice";
import type { InvoiceJobData } from "../queues";

const INVOICE_WORKER_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.INVOICE_WORKER_CONCURRENCY ?? "1", 10) || 1
);

export function createInvoiceWorker(redisUrl: string): Worker {
  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  return new Worker<InvoiceJobData>(
    "invoice-processing",
    async (job: Job<InvoiceJobData>) => {
      const { invoiceId, organizationId, fileUrl, mimeType } = job.data;

      console.log(
        `[invoice-worker] Processing ${invoiceId} (org: ${organizationId}, mime: ${mimeType})`
      );

      await job.updateProgress(5);

      // ── 1. Verify the invoice record still exists ─────────────────────────
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { id: true, referenceNo: true, submittedBy: true, status: true },
      });

      if (!invoice) {
        throw new Error(`Invoice ${invoiceId} not found in database`);
      }

      // Allow retries to reprocess invoices that were marked "error" by a previous
      // failed attempt. Keep skipping terminal successful statuses.
      const isRetryAttempt = job.attemptsMade > 0;
      const allowedStatuses = isRetryAttempt
        ? new Set(["processing", "received", "error"])
        : new Set(["processing", "received"]);
      if (!allowedStatuses.has(invoice.status)) {
        console.log(
          `[invoice-worker] Skipping ${invoiceId} — already in status "${invoice.status}"`
        );
        return { invoiceId, status: invoice.status, skipped: true };
      }

      if (isRetryAttempt) {
        await Promise.all([
          prisma.extractedField.deleteMany({ where: { invoiceId } }),
          prisma.lineItem.deleteMany({ where: { invoiceId } }),
        ]);
      }

      await job.updateProgress(10);

      // ── 2. Download file buffer from storage ─────────────────────────────
      console.log(`[invoice-worker] Reading file: ${fileUrl}`);
      const buffer = await readFile(fileUrl);

      await job.updateProgress(20);

      // ── 3. Run the full OCR + extraction pipeline ─────────────────────────
      await processInvoicePipeline(
        invoiceId,
        invoice.referenceNo,
        buffer,
        mimeType,
        invoice.submittedBy,
        organizationId,
        { rethrowOnError: true }
      );

      await job.updateProgress(100);

      // Reload final status from DB for the return value
      const updated = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { status: true },
      });

      console.log(
        `[invoice-worker] Completed ${invoiceId} → status: ${updated?.status}`
      );

      return { invoiceId, status: updated?.status ?? "extracted" };
    },
    {
      connection,
      concurrency: INVOICE_WORKER_CONCURRENCY,
    }
  );
}

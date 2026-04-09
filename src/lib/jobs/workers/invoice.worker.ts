// Anzu Dynamics — Invoice Processing Worker
// BullMQ worker that handles the OCR + AI extraction pipeline.
// Runs as a standalone process via workers/index.ts (not in Next.js runtime).
//
// Pipeline:
//   1. Download invoice file from storage
//   2. Run OCR / XML parsing (delegates to existing src/lib/claude.ts logic)
//   3. Update Invoice record status + extracted fields
//   4. Trigger AI PO matching suggestion

import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import type { InvoiceJobData } from "../queues";

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
        `[invoice-worker] Processing invoice ${invoiceId} for org ${organizationId}`
      );

      // NOTE: Full pipeline implementation in Step 5.
      // This scaffold ensures the queue + worker infrastructure is wired up.
      // The actual OCR call will import from src/lib/claude.ts.

      await job.updateProgress(10);
      console.log(`[invoice-worker] Extracting: ${fileUrl} (${mimeType})`);
      await job.updateProgress(100);

      return { invoiceId, status: "extracted" };
    },
    {
      connection,
      concurrency: 3, // process up to 3 invoices simultaneously
    }
  );
}

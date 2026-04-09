// Anzu Dynamics — RPA BullMQ Worker
// Processes jobs from the "rpa-execution" queue.
// Each job: decrypt credential → load invoice → run ERP connector → update DB.
//
// Runs as a standalone process via workers/index.ts (NOT inside Next.js runtime).
// Concurrency 2 — Playwright is resource-heavy (~200MB RAM per browser instance).

import { Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { prisma } from "../../prisma";
import { decryptErpCredential } from "../../vault";
import { createErpConnector } from "../../rpa/factory";
import type { RpaJobData } from "../queues";
import type { InvoiceSubmitPayload } from "../../rpa/base-connector";

export function createRpaWorker(redisUrl: string): Worker {
  const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  return new Worker<RpaJobData>(
    "rpa-execution",
    async (job: Job<RpaJobData>) => {
      const { invoiceId, organizationId, credentialId, erpType, action } = job.data;

      console.log(
        `[rpa-worker] Starting ${action} for invoice ${invoiceId} → ${erpType}`
      );

      await job.updateProgress(5);

      // ── 1. Fetch and decrypt the ERP credential ──────────────────────────────
      const credRecord = await prisma.erpCredential.findUnique({
        where: { id: credentialId },
      });

      if (!credRecord) {
        throw new Error(`ERP credential ${credentialId} not found`);
      }
      if (credRecord.organizationId !== organizationId) {
        throw new Error(`Credential ${credentialId} does not belong to org ${organizationId}`);
      }

      const credentialData = decryptErpCredential({
        encryptedData: credRecord.encryptedData,
        iv: credRecord.iv,
        authTag: credRecord.authTag,
      });

      await job.updateProgress(15);

      // ── 2. Load invoice data ──────────────────────────────────────────────────
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          extractedData: true,
          lineItems: true,
        },
      });

      if (!invoice) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

      // Helper to get a field value from extracted data
      const field = (name: string) =>
        invoice.extractedData.find((f) => f.fieldName === name)?.value ?? null;

      const payload: InvoiceSubmitPayload = {
        invoiceId:     invoice.id,
        referenceNo:   invoice.referenceNo,
        vendorName:    field("vendor_name"),
        totalAmount:   field("total") ? `${field("currency") ?? ""} ${field("total")}`.trim() : null,
        currency:      field("currency"),
        invoiceDate:   field("issue_date"),
        invoiceNumber: field("invoice_number"),
        lineItems: invoice.lineItems.map((li) => ({
          description: li.description,
          quantity:    li.quantity,
          unitPrice:   li.unitPrice,
          lineTotal:   li.lineTotal,
          category:    li.category ?? null,
        })),
      };

      await job.updateProgress(25);

      // ── 3. Run the ERP connector ──────────────────────────────────────────────
      const connector = createErpConnector(erpType, credentialData);
      const result = await connector.run(payload);

      await job.updateProgress(90);

      // ── 4. Update invoice status + log the event ──────────────────────────────
      if (result.success) {
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: { status: "exported" },
        });
      }

      await prisma.ingestionEvent.create({
        data: {
          invoiceId,
          eventType: result.success ? "rpa_submitted" : "rpa_failed",
          metadata: JSON.stringify({
            erpType,
            credentialId,
            action,
            success:      result.success,
            erpReference: result.erpReference ?? null,
            message:      result.message,
          }),
        },
      });

      await job.updateProgress(100);

      if (!result.success) {
        throw new Error(`RPA submission failed: ${result.message}`);
      }

      console.log(
        `[rpa-worker] Invoice ${invoiceId} submitted → ref: ${result.erpReference}`
      );

      return {
        invoiceId,
        erpReference: result.erpReference,
        message: result.message,
      };
    },
    {
      connection,
      concurrency: 2, // each job may open a Playwright browser (~200MB RAM)
    }
  );
}

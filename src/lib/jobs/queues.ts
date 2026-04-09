// Anzu Dynamics — BullMQ Queue Definitions
// Two queues handle all async work:
//   invoice-processing — OCR extraction, AI validation, duplicate detection
//   rpa-execution      — Playwright-driven ERP login + document submission
//
// Workers are run as a separate process in workers/index.ts.
// In development, set REDIS_URL="redis://localhost:6379".

import { Queue } from "bullmq";
import { Redis } from "ioredis";

// Shared Redis connection for all queues.
// maxRetriesPerRequest: null is required by BullMQ.
let _connection: Redis | null = null;

function getConnection(): Redis {
  if (!_connection) {
    _connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return _connection;
}

// ── Job payload types ─────────────────────────────────────────────────────────

export interface InvoiceJobData {
  invoiceId: string;
  organizationId: string;
  fileUrl: string;
  mimeType: string;
}

export interface RpaJobData {
  invoiceId: string;
  organizationId: string;
  credentialId: string;  // ErpCredential.id — decrypted at worker time
  erpType: string;       // "sinco" | "sap_b1" | "contpaq" | "siigo"
  action: "submit" | "status_check" | "void";
}

// ── Queue instances ───────────────────────────────────────────────────────────

/** Handles OCR extraction + AI validation for uploaded invoices */
export const invoiceQueue = new Queue<InvoiceJobData>("invoice-processing", {
  connection: getConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});

/** Handles Playwright RPA sessions for ERP submission */
export const rpaQueue = new Queue<RpaJobData>("rpa-execution", {
  connection: getConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 5000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});

// ── Helper: enqueue an invoice for processing ─────────────────────────────────

export async function enqueueInvoice(data: InvoiceJobData): Promise<string> {
  const job = await invoiceQueue.add("process", data, {
    jobId: `invoice-${data.invoiceId}`,
  });
  return job.id ?? data.invoiceId;
}

export async function enqueueRpa(data: RpaJobData): Promise<string> {
  const job = await rpaQueue.add("rpa", data, {
    jobId: `rpa-${data.invoiceId}-${data.action}`,
  });
  return job.id ?? data.invoiceId;
}

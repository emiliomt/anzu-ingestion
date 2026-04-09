// Anzu Dynamics — BullMQ Worker Process Entry Point
// Run this as a separate process alongside the Next.js app:
//   npx ts-node workers/index.ts
// Or via docker-compose as an additional service (see docker-compose.yml).
//
// This process handles long-running tasks that cannot block the HTTP request cycle:
//   - OCR extraction (up to 30s per invoice)
//   - Playwright RPA sessions (up to 120s per ERP submission)

import { createInvoiceWorker } from "../src/lib/jobs/workers/invoice.worker";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

console.log("[workers] Starting Anzu background workers...");
console.log(`[workers] Redis: ${REDIS_URL}`);

// ── Invoice processing worker ─────────────────────────────────────────────────
const invoiceWorker = createInvoiceWorker(REDIS_URL);

invoiceWorker.on("completed", (job) => {
  console.log(`[invoice-worker] ✓ Job ${job.id} completed`);
});

invoiceWorker.on("failed", (job, err) => {
  console.error(`[invoice-worker] ✗ Job ${job?.id} failed:`, err.message);
});

invoiceWorker.on("error", (err) => {
  console.error("[invoice-worker] Worker error:", err);
});

// ── RPA worker placeholder — implemented in Step 3 ───────────────────────────
// import { createRpaWorker } from "../src/lib/jobs/workers/rpa.worker";
// const rpaWorker = createRpaWorker(REDIS_URL);

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown() {
  console.log("[workers] Shutting down gracefully...");
  await invoiceWorker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("[workers] All workers running. Waiting for jobs...");

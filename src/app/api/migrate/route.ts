// Anzu Dynamics — One-time DB schema migration endpoint
// POST /api/migrate?secret=<MIGRATE_SECRET>
// Adds missing columns and tables when prisma db push has not run successfully.
// Remove or disable this route after the schema is in sync.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.MIGRATE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const steps: string[] = [];
  const errors: string[] = [];

  async function run(label: string, sql: string) {
    try {
      await prisma.$executeRawUnsafe(sql);
      steps.push(`✓ ${label}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`✗ ${label}: ${msg}`);
    }
  }

  // ── organizationId column — all tenant-scoped tables ─────────────────────────
  await run('invoices.organizationId',       `ALTER TABLE invoices         ADD COLUMN IF NOT EXISTS "organizationId" TEXT`);
  await run('vendors.organizationId',        `ALTER TABLE vendors          ADD COLUMN IF NOT EXISTS "organizationId" TEXT`);
  await run('projects.organizationId',       `ALTER TABLE projects         ADD COLUMN IF NOT EXISTS "organizationId" TEXT`);
  await run('purchase_orders.organizationId',`ALTER TABLE purchase_orders  ADD COLUMN IF NOT EXISTS "organizationId" TEXT`);
  await run('caja_chica.organizationId',     `ALTER TABLE caja_chica       ADD COLUMN IF NOT EXISTS "organizationId" TEXT`);
  await run('custom_fields.organizationId',  `ALTER TABLE custom_fields    ADD COLUMN IF NOT EXISTS "organizationId" TEXT`);
  await run('invoice_matches.organizationId',`ALTER TABLE invoice_matches  ADD COLUMN IF NOT EXISTS "organizationId" TEXT`);
  await run('erp_export_profiles.organizationId', `ALTER TABLE erp_export_profiles ADD COLUMN IF NOT EXISTS "organizationId" TEXT`);

  // ── invoices: remaining missing columns ──────────────────────────────────────
  await run('invoices.paidAt',          `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP`);
  await run('invoices.reviewedBy',      `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT`);
  await run('invoices.ocrText',         `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "ocrText" TEXT`);
  await run('invoices.updatedAt',       `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()`);
  await run('invoices.correctedData',   `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "correctedData" TEXT`);
  await run('invoices.fineTuneStatus',  `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "fineTuneStatus" TEXT NOT NULL DEFAULT 'PENDING'`);
  await run('invoices.fineTuneJobId',   `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "fineTuneJobId" TEXT`);
  await run('invoices.correctedBy',     `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "correctedBy" TEXT`);
  await run('invoices.correctionNotes', `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "correctionNotes" TEXT`);
  await run('invoices.isDuplicate',     `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "isDuplicate" BOOLEAN NOT NULL DEFAULT FALSE`);
  await run('invoices.duplicateOf',     `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "duplicateOf" TEXT`);

  // ── indexes ──────────────────────────────────────────────────────────────────
  await run('idx invoices.orgId',        `CREATE INDEX IF NOT EXISTS "invoices_organizationId_idx" ON invoices("organizationId")`);
  await run('idx invoices.orgId+status', `CREATE INDEX IF NOT EXISTS "invoices_organizationId_status_idx" ON invoices("organizationId", status)`);
  await run('idx vendors.orgId',         `CREATE INDEX IF NOT EXISTS "vendors_organizationId_idx" ON vendors("organizationId")`);
  await run('idx projects.orgId',        `CREATE INDEX IF NOT EXISTS "projects_organizationId_idx" ON projects("organizationId")`);
  await run('idx purchase_orders.orgId', `CREATE INDEX IF NOT EXISTS "purchase_orders_organizationId_idx" ON purchase_orders("organizationId")`);
  await run('idx caja_chica.orgId',      `CREATE INDEX IF NOT EXISTS "caja_chica_organizationId_idx" ON caja_chica("organizationId")`);
  await run('idx custom_fields.orgId',   `CREATE INDEX IF NOT EXISTS "custom_fields_organizationId_idx" ON custom_fields("organizationId")`);
  await run('idx invoice_matches.orgId', `CREATE INDEX IF NOT EXISTS "invoice_matches_organizationId_idx" ON invoice_matches("organizationId")`);

  // ── erp_credentials ──────────────────────────────────────────────────────────
  await run('create erp_credentials', `
    CREATE TABLE IF NOT EXISTS erp_credentials (
      id TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "erpType" TEXT NOT NULL,
      label TEXT NOT NULL,
      "encryptedData" TEXT NOT NULL,
      iv TEXT NOT NULL,
      "authTag" TEXT NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await run('idx erp_credentials.orgId', `CREATE INDEX IF NOT EXISTS "erp_credentials_organizationId_idx" ON erp_credentials("organizationId")`);

  // ── subscriptions ─────────────────────────────────────────────────────────────
  await run('create subscriptions', `
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT NOT NULL PRIMARY KEY,
      "organizationId" TEXT NOT NULL UNIQUE,
      "stripeCustomerId" TEXT,
      "stripeSubId" TEXT,
      plan TEXT NOT NULL DEFAULT 'demo',
      status TEXT NOT NULL DEFAULT 'active',
      "currentPeriodEnd" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  // ── demo_sessions ─────────────────────────────────────────────────────────────
  await run('create demo_sessions', `
    CREATE TABLE IF NOT EXISTS demo_sessions (
      id TEXT NOT NULL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      "organizationId" TEXT NOT NULL,
      "expiresAt" TIMESTAMP NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await run('idx demo_sessions.orgId', `CREATE INDEX IF NOT EXISTS "demo_sessions_organizationId_idx" ON demo_sessions("organizationId")`);

  return NextResponse.json({ ok: errors.length === 0, steps, errors });
}

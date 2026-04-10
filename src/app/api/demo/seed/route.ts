// Anzu Dynamics — Demo Seed API
// POST /api/demo/seed — creates a set of realistic sample invoices for the
// current org and returns a signed JWT (30-min TTL) for the shareable preview link.
//
// The token encodes { orgId, sessionId } and is verified by /demo-preview/[token].
// Requires DEMO_JWT_SECRET to be set; returns 501 if missing.
// Idempotent: calling multiple times replaces the sample invoices (tagged isDemoData).

import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { requireAdmin, RoleError } from "@/lib/roles";

export const dynamic = "force-dynamic";

const DEMO_VENDORS = [
  { name: "Construcciones Modernas SAS",  address: "Calle 72 #10-34, Bogotá",      taxId: "900.123.456-7" },
  { name: "Suministros Industriales Ltda", address: "Av. 30 de Agosto #45-12, Pereira", taxId: "900.234.567-8" },
  { name: "Ferretería El Constructor",     address: "Carrera 15 #28-50, Medellín",  taxId: "800.345.678-9" },
  { name: "Transportes Nacional SA",       address: "Calle 26 #68D-35, Bogotá",     taxId: "860.456.789-0" },
  { name: "Tech Solutions Colombia SAS",   address: "Cr 43A #7-50, El Poblado, Medellín", taxId: "901.567.890-1" },
];

const DEMO_INVOICES = [
  { vendor: 0, amount: 4850000,  tax: 921500,  currency: "COP", inv: "FV-2024-0891", status: "reviewed",  flags: [] },
  { vendor: 1, amount: 12300000, tax: 2337000, currency: "COP", inv: "FV-2024-0892", status: "extracted", flags: ["low_confidence"] },
  { vendor: 2, amount: 780000,   tax: 148200,  currency: "COP", inv: "FV-2024-0893", status: "reviewed",  flags: [] },
  { vendor: 3, amount: 2150000,  tax: 408500,  currency: "COP", inv: "TRN-2024-441", status: "reviewed",  flags: [] },
  { vendor: 0, amount: 9400000,  tax: 1786000, currency: "COP", inv: "FV-2024-0894", status: "extracted", flags: ["duplicate"] },
  { vendor: 4, amount: 3600000,  tax: 684000,  currency: "COP", inv: "TECH-2024-112",status: "reviewed",  flags: [] },
  { vendor: 1, amount: 5250000,  tax: 997500,  currency: "COP", inv: "FV-2024-0895", status: "error",     flags: ["extraction_failed"] },
  { vendor: 2, amount: 1890000,  tax: 359100,  currency: "COP", inv: "FV-2024-0896", status: "reviewed",  flags: [] },
];

export async function POST() {
  try {
    const secret = process.env.DEMO_JWT_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "DEMO_JWT_SECRET is not configured. Set it in your environment." },
        { status: 501 }
      );
    }

    const { orgId } = await requireAdmin();

    // ── 1. Remove existing demo invoices for this org ─────────────────────────
    const existing = await prisma.invoice.findMany({
      where: { organizationId: orgId, channel: "demo" },
      select: { id: true },
    });
    if (existing.length > 0) {
      await prisma.invoice.deleteMany({
        where: { id: { in: existing.map((i) => i.id) } },
      });
    }

    // ── 2. Upsert demo vendors ────────────────────────────────────────────────
    const vendorIds: string[] = [];
    for (const v of DEMO_VENDORS) {
      const vendor = await prisma.vendor.upsert({
        where: { id: `demo-vendor-${orgId}-${v.taxId}` },
        create: {
          id: `demo-vendor-${orgId}-${v.taxId}`,
          organizationId: orgId,
          name: v.name,
          address: v.address,
        },
        update: { name: v.name, address: v.address },
      });
      vendorIds.push(vendor.id);
    }

    // ── 3. Create demo invoices ───────────────────────────────────────────────
    const now = new Date();
    const createdInvoices: string[] = [];

    for (let i = 0; i < DEMO_INVOICES.length; i++) {
      const d = DEMO_INVOICES[i];
      const submittedAt = new Date(now.getTime() - (DEMO_INVOICES.length - i) * 2 * 24 * 60 * 60 * 1000);
      const refNo = `ANZ-DEMO-${String(i + 1).padStart(4, "0")}`;

      const invoice = await prisma.invoice.create({
        data: {
          referenceNo:    refNo,
          organizationId: orgId,
          channel:        "demo",
          status:         d.status,
          fileUrl:        "/demo/sample-invoice.pdf",
          fileName:       `demo-invoice-${i + 1}.pdf`,
          mimeType:       "application/pdf",
          fileSize:       102400,
          submittedAt,
          processedAt:    d.status !== "error" ? new Date(submittedAt.getTime() + 8000) : null,
          vendorId:       vendorIds[d.vendor],
          flags:          JSON.stringify(d.flags),
          isDuplicate:    d.flags.includes("duplicate"),
        },
      });

      createdInvoices.push(invoice.id);

      // Core extracted fields
      if (d.status !== "error") {
        const total = d.amount + d.tax;
        await prisma.extractedField.createMany({
          data: [
            { invoiceId: invoice.id, fieldName: "vendor_name",    value: DEMO_VENDORS[d.vendor].name, confidence: 0.97, isUncertain: false },
            { invoiceId: invoice.id, fieldName: "vendor_tax_id",  value: DEMO_VENDORS[d.vendor].taxId, confidence: 0.95, isUncertain: false },
            { invoiceId: invoice.id, fieldName: "invoice_number", value: d.inv, confidence: 0.99, isUncertain: false },
            { invoiceId: invoice.id, fieldName: "issue_date",     value: submittedAt.toISOString().slice(0, 10), confidence: 0.98, isUncertain: false },
            { invoiceId: invoice.id, fieldName: "total",          value: String(total), confidence: d.flags.includes("low_confidence") ? 0.72 : 0.96, isUncertain: d.flags.includes("low_confidence") },
            { invoiceId: invoice.id, fieldName: "subtotal",       value: String(d.amount), confidence: 0.95, isUncertain: false },
            { invoiceId: invoice.id, fieldName: "tax",            value: String(d.tax), confidence: 0.94, isUncertain: false },
            { invoiceId: invoice.id, fieldName: "currency",       value: d.currency, confidence: 0.99, isUncertain: false },
          ],
        });

        await prisma.ingestionEvent.create({
          data: {
            invoiceId: invoice.id,
            eventType: d.status === "reviewed" ? "reviewed" : "extracted",
            metadata:  JSON.stringify({ demo: true, fieldsExtracted: 8 }),
          },
        });
      } else {
        await prisma.ingestionEvent.create({
          data: {
            invoiceId: invoice.id,
            eventType: "extraction_failed",
            metadata:  JSON.stringify({ demo: true, error: "Simulated extraction failure" }),
          },
        });
      }
    }

    // ── 4. Issue / upsert DemoSession + sign JWT ──────────────────────────────
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    const session = await prisma.demoSession.create({
      data: {
        organizationId: orgId,
        token:          "", // placeholder; updated after JWT is signed
        expiresAt,
      },
    });

    const token = await new SignJWT({ orgId, sessionId: session.id })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30m")
      .sign(new TextEncoder().encode(secret));

    await prisma.demoSession.update({
      where: { id: session.id },
      data:  { token },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const previewUrl = `${appUrl}/demo-preview/${token}`;

    return NextResponse.json(
      { url: previewUrl, expiresAt: expiresAt.toISOString(), invoicesCreated: createdInvoices.length },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof RoleError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[demo/seed POST]", err);
    return NextResponse.json({ error: "Failed to seed demo data" }, { status: 500 });
  }
}

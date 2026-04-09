/**
 * Prisma seed — sample invoices, POs, projects, vendors, caja chica
 * Run: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
 *   or after adding "prisma.seed" to package.json: npx prisma db seed
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Helpers ────────────────────────────────────────────────────────────────
function ref(n: number) {
  return `AZ-2025-SEED${String(n).padStart(2, "0")}`;
}

async function main() {
  console.log("🌱  Seeding sample data…");

  // ── 1. Vendors ────────────────────────────────────────────────────────────
  const [acero, tecno, servi, logis] = await Promise.all([
    prisma.vendor.upsert({
      where: { id: "vendor-acero-001" },
      update: {},
      create: {
        id: "vendor-acero-001",
        name: "Aceros del Norte S.A.S.",
        email: "facturacion@acerosnorte.co",
        phone: "+57 312 000 0001",
        address: "Cra 50 #80-12, Medellín",
      },
    }),
    prisma.vendor.upsert({
      where: { id: "vendor-tecno-001" },
      update: {},
      create: {
        id: "vendor-tecno-001",
        name: "TecnoSuministros Ltda.",
        email: "cuentas@tecnosum.com.co",
        phone: "+57 601 000 0002",
        address: "Ak 15 #105-33, Bogotá",
      },
    }),
    prisma.vendor.upsert({
      where: { id: "vendor-servi-001" },
      update: {},
      create: {
        id: "vendor-servi-001",
        name: "ServiObra Colombia",
        email: "pagos@serviobra.co",
        phone: "+57 315 000 0003",
        address: "Cl 10 #3-45, Cali",
      },
    }),
    prisma.vendor.upsert({
      where: { id: "vendor-logis-001" },
      update: {},
      create: {
        id: "vendor-logis-001",
        name: "Logística Express S.A.",
        email: "billing@logexpress.co",
        phone: "+57 605 000 0004",
        address: "Zona Franca, Barranquilla",
      },
    }),
  ]);

  // ── 2. Projects ───────────────────────────────────────────────────────────
  const [proyA, proyB, proyC] = await Promise.all([
    prisma.project.upsert({
      where: { id: "project-hq-001" },
      update: {},
      create: {
        id: "project-hq-001",
        name: "Sede Principal Bogotá",
        code: "PROY-2025-HQ",
        address: "Ak 9 #115-06, Bogotá",
        city: "Bogotá",
        vat: "900.123.456-7",
        supervisor: "Carlos Mendoza",
        budget: 450_000_000,
        currency: "COP",
        status: "active",
        description: "Construcción y adecuación sede principal",
        startDate: new Date("2025-01-15"),
        endDate: new Date("2025-12-31"),
      },
    }),
    prisma.project.upsert({
      where: { id: "project-med-001" },
      update: {},
      create: {
        id: "project-med-001",
        name: "Bodega Medellín",
        code: "PROY-2025-MED",
        address: "Cra 50 #12-34, Medellín",
        city: "Medellín",
        vat: "900.234.567-8",
        supervisor: "Ana Restrepo",
        budget: 180_000_000,
        currency: "COP",
        status: "active",
        description: "Ampliación y equipamiento bodega",
        startDate: new Date("2025-03-01"),
        endDate: new Date("2025-09-30"),
      },
    }),
    prisma.project.upsert({
      where: { id: "project-cal-001" },
      update: {},
      create: {
        id: "project-cal-001",
        name: "Oficina Cali",
        code: "PROY-2025-CAL",
        address: "Cl 10 #3-45, Cali",
        city: "Cali",
        vat: "900.345.678-9",
        supervisor: "Jorge Ospina",
        budget: 95_000_000,
        currency: "COP",
        status: "on_hold",
        description: "Remodelación y mobiliario",
        startDate: new Date("2025-06-01"),
        endDate: new Date("2025-11-30"),
      },
    }),
  ]);

  // ── 3. Purchase Orders ────────────────────────────────────────────────────
  const [po1, po2, po3, po4] = await Promise.all([
    prisma.purchaseOrder.upsert({
      where: { id: "po-001" },
      update: {},
      create: {
        id: "po-001",
        poNumber: "OC-2025-001",
        projectId: proyA.id,
        vendorId: acero.id,
        vendorName: acero.name,
        vendorTaxId: "800.111.222-3",
        description: "Suministro estructuras metálicas — fase 1",
        totalAmount: 85_000_000,
        currency: "COP",
        issueDate: new Date("2025-02-01"),
        expiryDate: new Date("2025-07-31"),
        status: "open",
        source: "manual",
      },
    }),
    prisma.purchaseOrder.upsert({
      where: { id: "po-002" },
      update: {},
      create: {
        id: "po-002",
        poNumber: "OC-2025-002",
        projectId: proyA.id,
        vendorId: tecno.id,
        vendorName: tecno.name,
        vendorTaxId: "800.222.333-4",
        description: "Equipos de cómputo y redes",
        totalAmount: 42_000_000,
        currency: "COP",
        issueDate: new Date("2025-02-15"),
        expiryDate: new Date("2025-05-31"),
        status: "partially_matched",
        source: "manual",
      },
    }),
    prisma.purchaseOrder.upsert({
      where: { id: "po-003" },
      update: {},
      create: {
        id: "po-003",
        poNumber: "OC-2025-003",
        projectId: proyB.id,
        vendorId: servi.id,
        vendorName: servi.name,
        vendorTaxId: "800.333.444-5",
        description: "Mano de obra bodega Medellín",
        totalAmount: 28_500_000,
        currency: "COP",
        issueDate: new Date("2025-03-10"),
        expiryDate: new Date("2025-08-31"),
        status: "open",
        source: "manual",
      },
    }),
    prisma.purchaseOrder.upsert({
      where: { id: "po-004" },
      update: {},
      create: {
        id: "po-004",
        poNumber: "OC-2025-004",
        projectId: proyB.id,
        vendorId: logis.id,
        vendorName: logis.name,
        vendorTaxId: "800.444.555-6",
        description: "Transporte y logística — materiales",
        totalAmount: 12_000_000,
        currency: "COP",
        issueDate: new Date("2025-03-20"),
        expiryDate: new Date("2025-09-30"),
        status: "open",
        source: "manual",
      },
    }),
  ]);

  // ── 4. Caja Chica ─────────────────────────────────────────────────────────
  const [cc1, cc2] = await Promise.all([
    prisma.cajaChica.upsert({
      where: { id: "cc-bogota-q1" },
      update: {},
      create: {
        id: "cc-bogota-q1",
        name: "Caja Chica Bogotá Q1-2025",
        period: "Q1-2025",
        balance: 2_000_000,
        currency: "COP",
        status: "open",
      },
    }),
    prisma.cajaChica.upsert({
      where: { id: "cc-medellin-q1" },
      update: {},
      create: {
        id: "cc-medellin-q1",
        name: "Caja Chica Medellín Q1-2025",
        period: "Q1-2025",
        balance: 1_500_000,
        currency: "COP",
        status: "open",
      },
    }),
  ]);

  // ── 5. Invoices ───────────────────────────────────────────────────────────
  type InvoiceSeed = {
    id: string; refNo: string; vendorId: string; status: string;
    invoiceNumber: string; issueDate: string; total: string; currency: string;
    vendorName: string; vendorTaxId: string; subtotal: string; tax: string;
    lines: { desc: string; qty: number; unit: number; cat: string }[];
  };

  const invoiceSeeds: InvoiceSeed[] = [
    {
      id: "inv-001", refNo: ref(1), vendorId: acero.id, status: "extracted",
      invoiceNumber: "FE-2025-0341", issueDate: "2025-02-20", total: "14280000",
      currency: "COP", vendorName: acero.name, vendorTaxId: "800.111.222-3",
      subtotal: "12000000", tax: "2280000",
      lines: [
        { desc: "Viga IPE 200 x 6m", qty: 40, unit: 180000, cat: "material" },
        { desc: "Perno de anclaje M20", qty: 200, unit: 12000, cat: "material" },
        { desc: "Flete y entrega", qty: 1, unit: 360000, cat: "freight" },
      ],
    },
    {
      id: "inv-002", refNo: ref(2), vendorId: acero.id, status: "extracted",
      invoiceNumber: "FE-2025-0389", issueDate: "2025-03-05", total: "23940000",
      currency: "COP", vendorName: acero.name, vendorTaxId: "800.111.222-3",
      subtotal: "20118000", tax: "3822420",
      lines: [
        { desc: "Placa colaborante e=1.5mm", qty: 120, unit: 85000, cat: "material" },
        { desc: "Perfil C 150x50x4mm", qty: 80, unit: 62000, cat: "material" },
        { desc: "Instalación y soldadura", qty: 1, unit: 2158000, cat: "labor" },
      ],
    },
    {
      id: "inv-003", refNo: ref(3), vendorId: tecno.id, status: "reviewed",
      invoiceNumber: "TS-INV-00221", issueDate: "2025-02-28", total: "18620000",
      currency: "COP", vendorName: tecno.name, vendorTaxId: "800.222.333-4",
      subtotal: "15647059", tax: "2972941",
      lines: [
        { desc: "Portátil HP EliteBook 840", qty: 5, unit: 2500000, cat: "equipment" },
        { desc: "Switch 24 puertos PoE", qty: 2, unit: 1800000, cat: "equipment" },
        { desc: "Cableado estructurado Cat6A", qty: 1, unit: 2047059, cat: "labor" },
      ],
    },
    {
      id: "inv-004", refNo: ref(4), vendorId: tecno.id, status: "extracted",
      invoiceNumber: "TS-INV-00235", issueDate: "2025-03-12", total: "8120000",
      currency: "COP", vendorName: tecno.name, vendorTaxId: "800.222.333-4",
      subtotal: "6823529", tax: "1296471",
      lines: [
        { desc: "UPS 2KVA APC", qty: 3, unit: 1400000, cat: "equipment" },
        { desc: "Rack de piso 42U", qty: 1, unit: 1623529, cat: "equipment" },
      ],
    },
    {
      id: "inv-005", refNo: ref(5), vendorId: servi.id, status: "extracted",
      invoiceNumber: "SO-2025-112", issueDate: "2025-03-18", total: "9513000",
      currency: "COP", vendorName: servi.name, vendorTaxId: "800.333.444-5",
      subtotal: "7994118", tax: "1518882",
      lines: [
        { desc: "Cuadrilla albañilería (8 días)", qty: 8, unit: 750000, cat: "labor" },
        { desc: "Cuadrilla pintura (4 días)", qty: 4, unit: 598530, cat: "labor" },
      ],
    },
    {
      id: "inv-006", refNo: ref(6), vendorId: logis.id, status: "received",
      invoiceNumber: "LEX-0055-2025", issueDate: "2025-03-22", total: "3808000",
      currency: "COP", vendorName: logis.name, vendorTaxId: "800.444.555-6",
      subtotal: "3200000", tax: "608000",
      lines: [
        { desc: "Flete Bogotá-Medellín (camión 4t)", qty: 2, unit: 1200000, cat: "freight" },
        { desc: "Cargue y descargue", qty: 2, unit: 400000, cat: "labor" },
      ],
    },
    {
      id: "inv-007", refNo: ref(7), vendorId: servi.id, status: "extracted",
      invoiceNumber: "SO-2025-118", issueDate: "2025-03-25", total: "850000",
      currency: "COP", vendorName: servi.name, vendorTaxId: "800.333.444-5",
      subtotal: "714286", tax: "135714",
      lines: [
        { desc: "Materiales de aseo y cafetería", qty: 1, unit: 714286, cat: "other" },
      ],
    },
    {
      id: "inv-008", refNo: ref(8), vendorId: tecno.id, status: "extracted",
      invoiceNumber: "TS-INV-00248", issueDate: "2025-03-28", total: "420000",
      currency: "COP", vendorName: tecno.name, vendorTaxId: "800.222.333-4",
      subtotal: "352941", tax: "67059",
      lines: [
        { desc: "Tóner LaserJet HP", qty: 2, unit: 176471, cat: "other" },
      ],
    },
  ];

  for (const s of invoiceSeeds) {
    // Delete existing to allow re-seeding cleanly
    await prisma.lineItem.deleteMany({ where: { invoiceId: s.id } });
    await prisma.extractedField.deleteMany({ where: { invoiceId: s.id } });
    await prisma.ingestionEvent.deleteMany({ where: { invoiceId: s.id } });
    await prisma.invoiceMatch.deleteMany({ where: { invoiceId: s.id } });
    await prisma.invoice.deleteMany({ where: { id: s.id } });

    await prisma.invoice.create({
      data: {
        id: s.id,
        referenceNo: s.refNo,
        channel: "web",
        status: s.status,
        fileUrl: `/uploads/sample-invoice-${s.id}.pdf`,
        fileName: `invoice-${s.invoiceNumber}.pdf`,
        mimeType: "application/pdf",
        fileSize: 85000 + Math.floor(Math.random() * 50000),
        submittedBy: "seed@anzuingestion.co",
        submittedName: s.vendorName,
        vendorId: s.vendorId,
        flags: "[]",
        extractedData: {
          create: [
            { fieldName: "invoice_number", value: s.invoiceNumber, confidence: 0.98, isVerified: true },
            { fieldName: "issue_date",     value: s.issueDate,     confidence: 0.97, isVerified: true },
            { fieldName: "vendor_name",    value: s.vendorName,    confidence: 0.96, isVerified: true },
            { fieldName: "vendor_tax_id",  value: s.vendorTaxId,   confidence: 0.95, isVerified: false },
            { fieldName: "total",          value: s.total,         confidence: 0.99, isVerified: true },
            { fieldName: "subtotal",       value: s.subtotal,      confidence: 0.97, isVerified: false },
            { fieldName: "tax",            value: s.tax,           confidence: 0.96, isVerified: false },
            { fieldName: "currency",       value: s.currency,      confidence: 1.00, isVerified: true },
          ],
        },
        lineItems: {
          create: s.lines.map((l) => ({
            description: l.desc,
            quantity: l.qty,
            unitPrice: l.unit,
            lineTotal: l.qty * l.unit,
            category: l.cat,
            confidence: 0.94,
          })),
        },
        events: {
          create: [
            { eventType: "received",           timestamp: new Date("2025-03-01T08:00:00Z") },
            { eventType: "processing_started", timestamp: new Date("2025-03-01T08:00:05Z") },
            { eventType: "extracted",          timestamp: new Date("2025-03-01T08:00:22Z") },
          ],
        },
      },
    });
  }

  // ── 6. InvoiceMatches ─────────────────────────────────────────────────────
  // inv-001 & inv-002 → OC-2025-001 (Aceros / HQ)  — confirmed
  await prisma.invoiceMatch.upsert({
    where: { id: "match-001" },
    update: {},
    create: {
      id: "match-001",
      invoiceId: "inv-001",
      matchType: "purchase_order",
      purchaseOrderId: po1.id,
      projectId: proyA.id,
      confidence: 0.92,
      reasoning: "Vendor NIT and project match OC-2025-001; amounts within tolerance.",
      matchedBy: "ai",
      approvalStatus: "approved",
      isConfirmed: true,
      confirmedBy: "admin@anzu.co",
      confirmedAt: new Date("2025-03-02T10:30:00Z"),
    },
  });
  await prisma.invoiceMatch.upsert({
    where: { id: "match-002" },
    update: {},
    create: {
      id: "match-002",
      invoiceId: "inv-002",
      matchType: "purchase_order",
      purchaseOrderId: po1.id,
      projectId: proyA.id,
      confidence: 0.89,
      reasoning: "Same vendor OC-2025-001, second delivery batch.",
      matchedBy: "ai",
      approvalStatus: "approved",
      isConfirmed: true,
      confirmedBy: "admin@anzu.co",
      confirmedAt: new Date("2025-03-06T09:15:00Z"),
    },
  });
  // inv-003 → OC-2025-002 (TecnoSuministros / HQ) — confirmed
  await prisma.invoiceMatch.upsert({
    where: { id: "match-003" },
    update: {},
    create: {
      id: "match-003",
      invoiceId: "inv-003",
      matchType: "purchase_order",
      purchaseOrderId: po2.id,
      projectId: proyA.id,
      confidence: 0.95,
      reasoning: "Invoice number references OC-2025-002 in memo line.",
      matchedBy: "ai",
      approvalStatus: "approved",
      isConfirmed: true,
      confirmedBy: "admin@anzu.co",
      confirmedAt: new Date("2025-03-01T14:00:00Z"),
    },
  });
  // inv-004 → OC-2025-002 — pending
  await prisma.invoiceMatch.upsert({
    where: { id: "match-004" },
    update: {},
    create: {
      id: "match-004",
      invoiceId: "inv-004",
      matchType: "purchase_order",
      purchaseOrderId: po2.id,
      projectId: proyA.id,
      confidence: 0.81,
      reasoning: "Vendor and project match; lower confidence due to partial description match.",
      matchedBy: "ai",
      approvalStatus: "pending",
      isConfirmed: false,
    },
  });
  // inv-005 → OC-2025-003 (ServiObra / Medellín) — pending
  await prisma.invoiceMatch.upsert({
    where: { id: "match-005" },
    update: {},
    create: {
      id: "match-005",
      invoiceId: "inv-005",
      matchType: "purchase_order",
      purchaseOrderId: po3.id,
      projectId: proyB.id,
      confidence: 0.88,
      reasoning: "Labor invoice from ServiObra matching OC-2025-003 scope.",
      matchedBy: "ai",
      approvalStatus: "pending",
      isConfirmed: false,
    },
  });
  // inv-006 → OC-2025-004 (Logística) — pending
  await prisma.invoiceMatch.upsert({
    where: { id: "match-006" },
    update: {},
    create: {
      id: "match-006",
      invoiceId: "inv-006",
      matchType: "purchase_order",
      purchaseOrderId: po4.id,
      projectId: proyB.id,
      confidence: 0.86,
      reasoning: "Freight invoice aligns with OC-2025-004 transport scope.",
      matchedBy: "ai",
      approvalStatus: "pending",
      isConfirmed: false,
    },
  });
  // inv-007 → Caja Chica Medellín (small expense)
  await prisma.invoiceMatch.upsert({
    where: { id: "match-007" },
    update: {},
    create: {
      id: "match-007",
      invoiceId: "inv-007",
      matchType: "caja_chica",
      cajaChicaId: cc2.id,
      confidence: 0.97,
      reasoning: "Amount 850,000 COP is below petty-cash threshold; assigned to Caja Chica Medellín.",
      matchedBy: "ai",
      approvalStatus: "approved",
      isConfirmed: true,
      confirmedBy: "admin@anzu.co",
      confirmedAt: new Date("2025-03-26T11:00:00Z"),
    },
  });
  // inv-008 → Caja Chica Bogotá (small expense)
  await prisma.invoiceMatch.upsert({
    where: { id: "match-008" },
    update: {},
    create: {
      id: "match-008",
      invoiceId: "inv-008",
      matchType: "caja_chica",
      cajaChicaId: cc1.id,
      confidence: 0.98,
      reasoning: "Amount 420,000 COP below petty-cash threshold; assigned to Caja Chica Bogotá.",
      matchedBy: "ai",
      approvalStatus: "pending",
      isConfirmed: false,
    },
  });

  console.log("✅  Done — seeded:");
  console.log("   4 vendors, 3 projects, 4 purchase orders, 2 caja chica funds");
  console.log("   8 invoices (with extracted fields, line items, events)");
  console.log("   8 invoice matches (3 confirmed, 5 pending)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

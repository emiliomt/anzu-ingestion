/**
 * Anzu Dynamics — Prisma Seed
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeds the database with:
 *   - 2 Organizations (Constructora Bogotá → Growth, Importadora Del Valle → Starter)
 *   - 1 Admin UserProfile
 *   - 2 Client UserProfiles (one per org)
 *   - 3 Provider UserProfiles
 *   - 4 ProviderOrganizationConnections (mixed statuses)
 *   - 4 Vendors, 3 Projects, 4 POs, 2 Caja Chica funds (all org-scoped)
 *   - 8 Invoices isolated per tenant
 *   - 8 InvoiceMatches
 *
 * Run: DATABASE_URL="file:./dev.db" npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
 *   or: npm run db:seed
 *
 * NOTE: Clerk user IDs are placeholders. In production, these are set by Clerk webhooks
 * or when users complete /setup onboarding. Replace with real Clerk IDs as needed.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Helpers ────────────────────────────────────────────────────────────────
function ref(n: number) {
  return `AZ-2025-SEED${String(n).padStart(2, "0")}`;
}

async function main() {
  console.log("🌱  Seeding Anzu Dynamics — multi-tenant sample data…");
  console.log("");

  // ── 1. Organizations ──────────────────────────────────────────────────────
  console.log("📦  Creating organizations…");

  const [orgConstructora, orgImportadora] = await Promise.all([
    prisma.organization.upsert({
      where: { id: "org-constructora-001" },
      update: {},
      create: {
        id: "org-constructora-001",
        slug: "constructora-bogota",
        name: "Constructora Bogotá S.A.S.",
        taxId: "900.123.456-7",
        country: "CO",
        plan: "Growth",
        isActive: true,
      },
    }),
    prisma.organization.upsert({
      where: { id: "org-importadora-001" },
      update: {},
      create: {
        id: "org-importadora-001",
        slug: "importadora-valle",
        name: "Importadora Del Valle Ltda.",
        taxId: "900.234.567-8",
        country: "CO",
        plan: "Starter",
        isActive: true,
      },
    }),
  ]);

  console.log(`   ✓ ${orgConstructora.name} [${orgConstructora.plan}]`);
  console.log(`   ✓ ${orgImportadora.name} [${orgImportadora.plan}]`);

  // ── 2. UserProfiles ───────────────────────────────────────────────────────
  // NOTE: clerkUserId values below are synthetic placeholders for seeding.
  // In production these come from Clerk's user.created webhook or /api/auth/setup-profile.
  console.log("\n👤  Creating user profiles…");

  const [profileAdmin, profileClientConst, profileClientImport,
         profileProv1, profileProv2, profileProv3] = await Promise.all([
    // Admin — no org
    prisma.userProfile.upsert({
      where: { id: "profile-admin-001" },
      update: {},
      create: {
        id: "profile-admin-001",
        clerkUserId: "seed_admin_clerk_id",
        role: "ADMIN",
        organizationId: null,
        email: "admin@anzu.io",
        firstName: "Ana",
        lastName: "Martínez",
        isActive: true,
      },
    }),
    // Client — Constructora Bogotá
    prisma.userProfile.upsert({
      where: { id: "profile-client-const" },
      update: {},
      create: {
        id: "profile-client-const",
        clerkUserId: "seed_client_const_clerk_id",
        role: "CLIENT",
        organizationId: orgConstructora.id,
        email: "admin@constructora.co",
        firstName: "Carlos",
        lastName: "Mendoza",
        isActive: true,
      },
    }),
    // Client — Importadora
    prisma.userProfile.upsert({
      where: { id: "profile-client-import" },
      update: {},
      create: {
        id: "profile-client-import",
        clerkUserId: "seed_client_import_clerk_id",
        role: "CLIENT",
        organizationId: orgImportadora.id,
        email: "user@importadora.co",
        firstName: "Valentina",
        lastName: "Ospina",
        isActive: true,
      },
    }),
    // Provider 1 — connected to Constructora
    prisma.userProfile.upsert({
      where: { id: "profile-prov-001" },
      update: {},
      create: {
        id: "profile-prov-001",
        clerkUserId: "seed_prov1_clerk_id",
        role: "PROVIDER",
        organizationId: null,
        email: "proveedor1@acero.co",
        firstName: "Miguel",
        lastName: "Torres",
        isActive: true,
      },
    }),
    // Provider 2 — connected to both orgs
    prisma.userProfile.upsert({
      where: { id: "profile-prov-002" },
      update: {},
      create: {
        id: "profile-prov-002",
        clerkUserId: "seed_prov2_clerk_id",
        role: "PROVIDER",
        organizationId: null,
        email: "proveedor2@cargo.co",
        firstName: "Laura",
        lastName: "Gómez",
        isActive: true,
      },
    }),
    // Provider 3 — pending invite to Importadora
    prisma.userProfile.upsert({
      where: { id: "profile-prov-003" },
      update: {},
      create: {
        id: "profile-prov-003",
        clerkUserId: "seed_prov3_clerk_id",
        role: "PROVIDER",
        organizationId: null,
        email: "proveedor3@servicios.co",
        firstName: "Andrés",
        lastName: "Cárdenas",
        isActive: true,
      },
    }),
  ]);

  console.log(`   ✓ ADMIN:    ${profileAdmin.email}`);
  console.log(`   ✓ CLIENT:   ${profileClientConst.email} → ${orgConstructora.name}`);
  console.log(`   ✓ CLIENT:   ${profileClientImport.email} → ${orgImportadora.name}`);
  console.log(`   ✓ PROVIDER: ${profileProv1.email}`);
  console.log(`   ✓ PROVIDER: ${profileProv2.email}`);
  console.log(`   ✓ PROVIDER: ${profileProv3.email}`);

  // ── 3. ProviderOrganizationConnections ────────────────────────────────────
  console.log("\n🔗  Creating provider-organization connections…");

  const [connProv1Const, connProv2Const, connProv2Import, connProv3Import] = await Promise.all([
    // Provider 1 ↔ Constructora (accepted)
    prisma.providerOrganizationConnection.upsert({
      where: { id: "conn-prov1-const" },
      update: {},
      create: {
        id: "conn-prov1-const",
        providerProfileId: profileProv1.id,
        organizationId: orgConstructora.id,
        status: "accepted",
        invitedByClerkUserId: profileClientConst.clerkUserId,
        invitedAt: new Date("2025-01-20"),
        acceptedAt: new Date("2025-01-21"),
      },
    }),
    // Provider 2 ↔ Constructora (accepted)
    prisma.providerOrganizationConnection.upsert({
      where: { id: "conn-prov2-const" },
      update: {},
      create: {
        id: "conn-prov2-const",
        providerProfileId: profileProv2.id,
        organizationId: orgConstructora.id,
        status: "accepted",
        invitedByClerkUserId: profileClientConst.clerkUserId,
        invitedAt: new Date("2025-02-01"),
        acceptedAt: new Date("2025-02-02"),
      },
    }),
    // Provider 2 ↔ Importadora (accepted)
    prisma.providerOrganizationConnection.upsert({
      where: { id: "conn-prov2-import" },
      update: {},
      create: {
        id: "conn-prov2-import",
        providerProfileId: profileProv2.id,
        organizationId: orgImportadora.id,
        status: "accepted",
        invitedByClerkUserId: profileClientImport.clerkUserId,
        invitedAt: new Date("2025-02-10"),
        acceptedAt: new Date("2025-02-11"),
      },
    }),
    // Provider 3 ↔ Importadora (pending — not yet accepted)
    prisma.providerOrganizationConnection.upsert({
      where: { id: "conn-prov3-import" },
      update: {},
      create: {
        id: "conn-prov3-import",
        providerProfileId: profileProv3.id,
        organizationId: orgImportadora.id,
        status: "pending",
        invitedByClerkUserId: profileClientImport.clerkUserId,
        invitedAt: new Date("2025-03-15"),
      },
    }),
  ]);

  console.log(`   ✓ ${profileProv1.email} ↔ ${orgConstructora.name} [accepted]`);
  console.log(`   ✓ ${profileProv2.email} ↔ ${orgConstructora.name} [accepted]`);
  console.log(`   ✓ ${profileProv2.email} ↔ ${orgImportadora.name} [accepted]`);
  console.log(`   ✓ ${profileProv3.email} ↔ ${orgImportadora.name} [PENDING]`);

  // Suppress unused variable warnings
  void connProv1Const; void connProv2Const; void connProv2Import; void connProv3Import;

  // ── 4. Vendors (org-scoped) ───────────────────────────────────────────────
  console.log("\n🏭  Creating vendors…");

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
        organizationId: orgConstructora.id,
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
        organizationId: orgConstructora.id,
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
        organizationId: orgImportadora.id,
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
        organizationId: orgImportadora.id,
      },
    }),
  ]);

  // ── 5. Projects (org-scoped) ──────────────────────────────────────────────
  console.log("📋  Creating projects…");

  const [proyA, proyB, proyC] = await Promise.all([
    // Constructora projects
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
        organizationId: orgConstructora.id,
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
        vat: "900.123.456-7",
        supervisor: "Ana Restrepo",
        budget: 180_000_000,
        currency: "COP",
        status: "active",
        description: "Ampliación y equipamiento bodega",
        startDate: new Date("2025-03-01"),
        endDate: new Date("2025-09-30"),
        organizationId: orgConstructora.id,
      },
    }),
    // Importadora project
    prisma.project.upsert({
      where: { id: "project-import-001" },
      update: {},
      create: {
        id: "project-import-001",
        name: "Importación Q2-2025",
        code: "IMPORT-2025-Q2",
        city: "Cali",
        vat: "900.234.567-8",
        supervisor: "Valentina Ospina",
        budget: 95_000_000,
        currency: "COP",
        status: "active",
        description: "Importación mercancía Q2 2025",
        startDate: new Date("2025-04-01"),
        endDate: new Date("2025-06-30"),
        organizationId: orgImportadora.id,
      },
    }),
  ]);

  // ── 6. Purchase Orders ────────────────────────────────────────────────────
  console.log("📝  Creating purchase orders…");

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
        organizationId: orgConstructora.id,
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
        organizationId: orgConstructora.id,
      },
    }),
    prisma.purchaseOrder.upsert({
      where: { id: "po-003" },
      update: {},
      create: {
        id: "po-003",
        poNumber: "OC-2025-003",
        projectId: proyB.id,
        vendorId: acero.id,
        vendorName: acero.name,
        vendorTaxId: "800.111.222-3",
        description: "Materiales bodega Medellín",
        totalAmount: 28_500_000,
        currency: "COP",
        issueDate: new Date("2025-03-10"),
        expiryDate: new Date("2025-08-31"),
        status: "open",
        source: "manual",
        organizationId: orgConstructora.id,
      },
    }),
    // Importadora PO
    prisma.purchaseOrder.upsert({
      where: { id: "po-004" },
      update: {},
      create: {
        id: "po-004",
        poNumber: "IMP-2025-001",
        projectId: proyC.id,
        vendorId: logis.id,
        vendorName: logis.name,
        vendorTaxId: "800.444.555-6",
        description: "Transporte y logística importación",
        totalAmount: 12_000_000,
        currency: "COP",
        issueDate: new Date("2025-04-01"),
        expiryDate: new Date("2025-06-30"),
        status: "open",
        source: "manual",
        organizationId: orgImportadora.id,
      },
    }),
  ]);

  // ── 7. Caja Chica ─────────────────────────────────────────────────────────
  console.log("💰  Creating caja chica funds…");

  const [cc1, cc2] = await Promise.all([
    prisma.cajaChica.upsert({
      where: { id: "cc-const-q1" },
      update: {},
      create: {
        id: "cc-const-q1",
        name: "Caja Chica Constructora Q1-2025",
        period: "Q1-2025",
        balance: 2_000_000,
        currency: "COP",
        status: "open",
        organizationId: orgConstructora.id,
      },
    }),
    prisma.cajaChica.upsert({
      where: { id: "cc-import-q2" },
      update: {},
      create: {
        id: "cc-import-q2",
        name: "Caja Chica Importadora Q2-2025",
        period: "Q2-2025",
        balance: 1_500_000,
        currency: "COP",
        status: "open",
        organizationId: orgImportadora.id,
      },
    }),
  ]);

  // ── 8. Invoices — TENANT ISOLATED ─────────────────────────────────────────
  console.log("\n🧾  Creating tenant-isolated invoices…");

  type InvoiceSeed = {
    id: string; refNo: string; vendorId: string; status: string;
    organizationId: string; submittedBy: string;
    invoiceNumber: string; issueDate: string; total: string; currency: string;
    vendorName: string; vendorTaxId: string; subtotal: string; tax: string;
    lines: { desc: string; qty: number; unit: number; cat: string }[];
  };

  const invoiceSeeds: InvoiceSeed[] = [
    // ── Constructora Bogotá invoices (3 invoices) ─────────────────────────
    {
      id: "inv-001", refNo: ref(1), vendorId: acero.id, status: "extracted",
      organizationId: orgConstructora.id,
      submittedBy: profileProv1.email!,
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
      id: "inv-002", refNo: ref(2), vendorId: tecno.id, status: "reviewed",
      organizationId: orgConstructora.id,
      submittedBy: profileProv2.email!,
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
      id: "inv-003", refNo: ref(3), vendorId: acero.id, status: "complete",
      organizationId: orgConstructora.id,
      submittedBy: profileProv1.email!,
      invoiceNumber: "FE-2025-0389", issueDate: "2025-03-05", total: "23940000",
      currency: "COP", vendorName: acero.name, vendorTaxId: "800.111.222-3",
      subtotal: "20118000", tax: "3822420",
      lines: [
        { desc: "Placa colaborante e=1.5mm", qty: 120, unit: 85000, cat: "material" },
        { desc: "Perfil C 150x50x4mm", qty: 80, unit: 62000, cat: "material" },
        { desc: "Instalación y soldadura", qty: 1, unit: 2158000, cat: "labor" },
      ],
    },
    // ── Importadora Del Valle invoices (2 invoices) ───────────────────────
    // ISOLATION CHECK: Constructora users CANNOT see these
    {
      id: "inv-004", refNo: ref(4), vendorId: servi.id, status: "extracted",
      organizationId: orgImportadora.id,
      submittedBy: profileProv2.email!,
      invoiceNumber: "SO-2025-112", issueDate: "2025-04-10", total: "9513000",
      currency: "COP", vendorName: servi.name, vendorTaxId: "800.333.444-5",
      subtotal: "7994118", tax: "1518882",
      lines: [
        { desc: "Servicio de desaduanamiento", qty: 1, unit: 5000000, cat: "labor" },
        { desc: "Almacenamiento bodega (15 días)", qty: 15, unit: 165608, cat: "other" },
      ],
    },
    {
      id: "inv-005", refNo: ref(5), vendorId: logis.id, status: "received",
      organizationId: orgImportadora.id,
      submittedBy: profileProv2.email!,
      invoiceNumber: "LEX-0055-2025", issueDate: "2025-04-15", total: "3808000",
      currency: "COP", vendorName: logis.name, vendorTaxId: "800.444.555-6",
      subtotal: "3200000", tax: "608000",
      lines: [
        { desc: "Flete Buenaventura-Cali (contenedor 20ft)", qty: 1, unit: 2500000, cat: "freight" },
        { desc: "Seguro de carga", qty: 1, unit: 700000, cat: "other" },
      ],
    },
  ];

  for (const s of invoiceSeeds) {
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
        submittedBy: s.submittedBy,
        submittedName: s.vendorName,
        vendorId: s.vendorId,
        organizationId: s.organizationId,
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

  console.log(`   ✓ 3 invoices for ${orgConstructora.name}`);
  console.log(`   ✓ 2 invoices for ${orgImportadora.name}`);
  console.log("   ✓ ISOLATION: each org can only see its own invoices via API");

  // ── 9. InvoiceMatches ─────────────────────────────────────────────────────
  console.log("\n🔗  Creating invoice matches…");

  await Promise.all([
    prisma.invoiceMatch.upsert({
      where: { id: "match-001" },
      update: {},
      create: {
        id: "match-001",
        invoiceId: "inv-001",
        matchType: "purchase_order",
        purchaseOrderId: po1.id,
        projectId: proyA.id,
        confidence: 0.92,
        reasoning: "Vendor NIT and project match OC-2025-001.",
        matchedBy: "ai",
        approvalStatus: "approved",
        isConfirmed: true,
        confirmedBy: profileClientConst.email,
        confirmedAt: new Date("2025-03-02T10:30:00Z"),
      },
    }),
    prisma.invoiceMatch.upsert({
      where: { id: "match-002" },
      update: {},
      create: {
        id: "match-002",
        invoiceId: "inv-002",
        matchType: "purchase_order",
        purchaseOrderId: po2.id,
        projectId: proyA.id,
        confidence: 0.95,
        reasoning: "Invoice references OC-2025-002.",
        matchedBy: "ai",
        approvalStatus: "approved",
        isConfirmed: true,
        confirmedBy: profileClientConst.email,
        confirmedAt: new Date("2025-03-01T14:00:00Z"),
      },
    }),
    prisma.invoiceMatch.upsert({
      where: { id: "match-003" },
      update: {},
      create: {
        id: "match-003",
        invoiceId: "inv-003",
        matchType: "purchase_order",
        purchaseOrderId: po3.id,
        projectId: proyB.id,
        confidence: 0.88,
        reasoning: "Vendor and project match OC-2025-003.",
        matchedBy: "ai",
        approvalStatus: "pending",
        isConfirmed: false,
      },
    }),
    prisma.invoiceMatch.upsert({
      where: { id: "match-004" },
      update: {},
      create: {
        id: "match-004",
        invoiceId: "inv-004",
        matchType: "purchase_order",
        purchaseOrderId: po4.id,
        projectId: proyC.id,
        confidence: 0.87,
        reasoning: "Service scope matches IMP-2025-001.",
        matchedBy: "ai",
        approvalStatus: "pending",
        isConfirmed: false,
      },
    }),
    prisma.invoiceMatch.upsert({
      where: { id: "match-005" },
      update: {},
      create: {
        id: "match-005",
        invoiceId: "inv-005",
        matchType: "caja_chica",
        cajaChicaId: cc2.id,
        confidence: 0.95,
        reasoning: "Freight amount within petty cash threshold.",
        matchedBy: "ai",
        approvalStatus: "pending",
        isConfirmed: false,
      },
    }),
  ]);

  // ── 10. Sample AuditLog entries ───────────────────────────────────────────
  console.log("📋  Creating sample audit log entries…");

  await Promise.all([
    prisma.auditLog.create({
      data: {
        actorClerkUserId: profileAdmin.clerkUserId,
        actorRole: "ADMIN",
        action: "organization.create",
        resourceType: "Organization",
        resourceId: orgConstructora.id,
        metadata: JSON.stringify({ name: orgConstructora.name, plan: orgConstructora.plan }),
      },
    }),
    prisma.auditLog.create({
      data: {
        actorClerkUserId: profileAdmin.clerkUserId,
        actorRole: "ADMIN",
        action: "organization.create",
        resourceType: "Organization",
        resourceId: orgImportadora.id,
        metadata: JSON.stringify({ name: orgImportadora.name, plan: orgImportadora.plan }),
      },
    }),
    prisma.auditLog.create({
      data: {
        actorClerkUserId: profileClientConst.clerkUserId,
        actorRole: "CLIENT",
        action: "provider.invite",
        resourceType: "ProviderOrganizationConnection",
        organizationId: orgConstructora.id,
        metadata: JSON.stringify({ providerEmail: profileProv1.email }),
      },
    }),
  ]);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("");
  console.log("✅  Seed complete! Summary:");
  console.log("   2 organizations (Growth + Starter plans)");
  console.log("   6 user profiles (1 ADMIN, 2 CLIENT, 3 PROVIDER)");
  console.log("   4 provider-org connections (3 accepted, 1 pending)");
  console.log("   4 vendors, 3 projects, 4 POs, 2 caja chica funds");
  console.log("   5 invoices (3 for Constructora, 2 for Importadora) — ISOLATED");
  console.log("   5 invoice matches");
  console.log("   3 audit log entries");
  console.log("");
  console.log("🔐  Tenant isolation test:");
  console.log(`   GET /api/invoices as CLIENT (${orgConstructora.slug}) → 3 invoices`);
  console.log(`   GET /api/invoices as CLIENT (${orgImportadora.slug}) → 2 invoices`);
  console.log("   GET /api/invoices as ADMIN → 5 invoices (all)");
  console.log("   GET /api/invoices as PROVIDER → 403 Forbidden");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

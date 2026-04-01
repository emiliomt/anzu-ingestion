/*
  Warnings:

  - The primary key for the `settings` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The required column `id` was added to the `settings` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "country" TEXT NOT NULL DEFAULT 'CO',
    "plan" TEXT NOT NULL DEFAULT 'Starter',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clerkUserId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "organizationId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "provider_org_connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerProfileId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" DATETIME,
    "invitedByClerkUserId" TEXT,
    CONSTRAINT "provider_org_connections_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "user_profiles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "provider_org_connections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorClerkUserId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "organizationId" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_caja_chica" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "period" TEXT,
    "balance" REAL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "status" TEXT NOT NULL DEFAULT 'open',
    "organizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "caja_chica_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_caja_chica" ("balance", "createdAt", "currency", "id", "name", "period", "status", "updatedAt") SELECT "balance", "createdAt", "currency", "id", "name", "period", "status", "updatedAt" FROM "caja_chica";
DROP TABLE "caja_chica";
ALTER TABLE "new_caja_chica" RENAME TO "caja_chica";
CREATE INDEX "caja_chica_organizationId_idx" ON "caja_chica"("organizationId");
CREATE TABLE "new_custom_fields" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "prompt" TEXT,
    "fieldType" TEXT NOT NULL DEFAULT 'text',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "includeInExport" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "organizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "custom_fields_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_custom_fields" ("createdAt", "displayOrder", "fieldType", "id", "includeInExport", "isActive", "key", "name", "prompt") SELECT "createdAt", "displayOrder", "fieldType", "id", "includeInExport", "isActive", "key", "name", "prompt" FROM "custom_fields";
DROP TABLE "custom_fields";
ALTER TABLE "new_custom_fields" RENAME TO "custom_fields";
CREATE INDEX "custom_fields_organizationId_idx" ON "custom_fields"("organizationId");
CREATE UNIQUE INDEX "custom_fields_key_organizationId_key" ON "custom_fields"("key", "organizationId");
CREATE TABLE "new_erp_export_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "erpType" TEXT NOT NULL DEFAULT 'custom',
    "columnMapping" TEXT NOT NULL,
    "outputFormat" TEXT NOT NULL DEFAULT 'xlsx',
    "organizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "erp_export_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_erp_export_profiles" ("columnMapping", "createdAt", "erpType", "id", "name", "outputFormat", "updatedAt") SELECT "columnMapping", "createdAt", "erpType", "id", "name", "outputFormat", "updatedAt" FROM "erp_export_profiles";
DROP TABLE "erp_export_profiles";
ALTER TABLE "new_erp_export_profiles" RENAME TO "erp_export_profiles";
CREATE INDEX "erp_export_profiles_organizationId_idx" ON "erp_export_profiles"("organizationId");
CREATE TABLE "new_invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "referenceNo" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "submittedBy" TEXT,
    "submittedName" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "paidAt" DATETIME,
    "reviewedBy" TEXT,
    "flags" TEXT NOT NULL DEFAULT '[]',
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "duplicateOf" TEXT,
    "ocrText" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correctedData" TEXT,
    "fineTuneStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "fineTuneJobId" TEXT,
    "correctedBy" TEXT,
    "correctionNotes" TEXT,
    "organizationId" TEXT,
    "vendorId" TEXT,
    CONSTRAINT "invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "invoices_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_invoices" ("channel", "correctedBy", "correctedData", "correctionNotes", "duplicateOf", "fileName", "fileSize", "fileUrl", "fineTuneJobId", "fineTuneStatus", "flags", "id", "isDuplicate", "mimeType", "ocrText", "paidAt", "processedAt", "referenceNo", "reviewedBy", "status", "submittedAt", "submittedBy", "submittedName", "updatedAt", "vendorId") SELECT "channel", "correctedBy", "correctedData", "correctionNotes", "duplicateOf", "fileName", "fileSize", "fileUrl", "fineTuneJobId", "fineTuneStatus", "flags", "id", "isDuplicate", "mimeType", "ocrText", "paidAt", "processedAt", "referenceNo", "reviewedBy", "status", "submittedAt", "submittedBy", "submittedName", "updatedAt", "vendorId" FROM "invoices";
DROP TABLE "invoices";
ALTER TABLE "new_invoices" RENAME TO "invoices";
CREATE UNIQUE INDEX "invoices_referenceNo_key" ON "invoices"("referenceNo");
CREATE INDEX "invoices_organizationId_idx" ON "invoices"("organizationId");
CREATE TABLE "new_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "address" TEXT,
    "city" TEXT,
    "vat" TEXT,
    "supervisor" TEXT,
    "budget" REAL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "status" TEXT NOT NULL DEFAULT 'active',
    "description" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "organizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "projects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_projects" ("address", "budget", "city", "code", "createdAt", "currency", "description", "endDate", "id", "name", "startDate", "status", "supervisor", "updatedAt", "vat") SELECT "address", "budget", "city", "code", "createdAt", "currency", "description", "endDate", "id", "name", "startDate", "status", "supervisor", "updatedAt", "vat" FROM "projects";
DROP TABLE "projects";
ALTER TABLE "new_projects" RENAME TO "projects";
CREATE INDEX "projects_organizationId_idx" ON "projects"("organizationId");
CREATE TABLE "new_purchase_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poNumber" TEXT NOT NULL,
    "projectId" TEXT,
    "vendorId" TEXT,
    "vendorName" TEXT,
    "vendorTaxId" TEXT,
    "description" TEXT,
    "totalAmount" REAL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "issueDate" DATETIME,
    "expiryDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'open',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "fileUrl" TEXT,
    "ocrText" TEXT,
    "organizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "purchase_orders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_purchase_orders" ("createdAt", "currency", "description", "expiryDate", "fileUrl", "id", "issueDate", "ocrText", "poNumber", "projectId", "source", "status", "totalAmount", "updatedAt", "vendorId", "vendorName", "vendorTaxId") SELECT "createdAt", "currency", "description", "expiryDate", "fileUrl", "id", "issueDate", "ocrText", "poNumber", "projectId", "source", "status", "totalAmount", "updatedAt", "vendorId", "vendorName", "vendorTaxId" FROM "purchase_orders";
DROP TABLE "purchase_orders";
ALTER TABLE "new_purchase_orders" RENAME TO "purchase_orders";
CREATE UNIQUE INDEX "purchase_orders_poNumber_key" ON "purchase_orders"("poNumber");
CREATE INDEX "purchase_orders_organizationId_idx" ON "purchase_orders"("organizationId");
CREATE TABLE "new_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "organizationId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_settings" ("key", "updatedAt", "value") SELECT "key", "updatedAt", "value" FROM "settings";
DROP TABLE "settings";
ALTER TABLE "new_settings" RENAME TO "settings";
CREATE INDEX "settings_organizationId_idx" ON "settings"("organizationId");
CREATE UNIQUE INDEX "settings_key_organizationId_key" ON "settings"("key", "organizationId");
CREATE TABLE "new_vendors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "organizationId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "vendors_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_vendors" ("address", "createdAt", "email", "id", "name", "phone", "updatedAt") SELECT "address", "createdAt", "email", "id", "name", "phone", "updatedAt" FROM "vendors";
DROP TABLE "vendors";
ALTER TABLE "new_vendors" RENAME TO "vendors";
CREATE INDEX "vendors_organizationId_idx" ON "vendors"("organizationId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_clerkUserId_key" ON "user_profiles"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_org_connections_providerProfileId_organizationId_key" ON "provider_org_connections"("providerProfileId", "organizationId");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");

-- CreateIndex
CREATE INDEX "audit_logs_actorClerkUserId_idx" ON "audit_logs"("actorClerkUserId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

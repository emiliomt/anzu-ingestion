-- CreateTable
CREATE TABLE "erp_export_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "erpType" TEXT NOT NULL DEFAULT 'custom',
    "columnMapping" TEXT NOT NULL,
    "outputFormat" TEXT NOT NULL DEFAULT 'xlsx',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

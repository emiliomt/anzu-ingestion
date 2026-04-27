-- SQLite requires recreating the table to change the primary key.
-- Steps: create new table → copy data → drop old → rename.

-- CreateTable (new schema)
CREATE TABLE "settings_new" (
    "organizationId" TEXT NOT NULL DEFAULT 'default',
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    PRIMARY KEY ("organizationId", "key")
);

-- Copy existing rows, defaulting organizationId to 'default'
INSERT INTO "settings_new" ("organizationId", "key", "value", "updatedAt")
SELECT 'default', "key", "value", "updatedAt" FROM "settings";

-- Drop old table and rename
DROP TABLE "settings";
ALTER TABLE "settings_new" RENAME TO "settings";

-- CreateIndex
CREATE INDEX "settings_organizationId_idx" ON "settings"("organizationId");

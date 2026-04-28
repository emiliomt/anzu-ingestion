-- Add organizationId to settings and switch to composite primary key.

-- 1. Add the new column with a default so existing rows get 'default'
ALTER TABLE "settings" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT 'default';

-- 2. Drop the old single-column primary key
ALTER TABLE "settings" DROP CONSTRAINT "settings_pkey";

-- 3. Add the new composite primary key
ALTER TABLE "settings" ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("organizationId", "key");

-- 4. Add index on organizationId for tenant lookups
CREATE INDEX "settings_organizationId_idx" ON "settings"("organizationId");

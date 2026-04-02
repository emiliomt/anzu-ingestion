-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "organizations" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "organizations" ADD COLUMN "subscriptionStatus" TEXT;

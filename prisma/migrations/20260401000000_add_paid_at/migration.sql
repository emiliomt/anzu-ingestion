-- AlterTable: add paidAt to invoices for provider payment tracking
ALTER TABLE "invoices" ADD COLUMN "paidAt" DATETIME;

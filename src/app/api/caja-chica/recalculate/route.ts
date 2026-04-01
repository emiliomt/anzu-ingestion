import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const THRESHOLD_KEY = "petty_cash_threshold";
const DEFAULT_THRESHOLD = 400000;

export async function POST() {
  const setting = await prisma.setting.findFirst({ where: { key: THRESHOLD_KEY, organizationId: null } });
  const threshold = setting ? Number(setting.value) : DEFAULT_THRESHOLD;

  // Get all processed invoices with their total extracted field
  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ["extracted", "reviewed", "complete"] } },
    include: {
      extractedData: { where: { fieldName: "total" } },
      // Only skip invoices already confirmed against a PO or project
      invoiceMatches: {
        where: { matchType: { not: "caja_chica" }, isConfirmed: true },
      },
    },
  });

  let created = 0;
  let removed = 0;

  for (const invoice of invoices) {
    // Skip invoices locked to a PO/project
    if (invoice.invoiceMatches.length > 0) continue;

    const totalField = invoice.extractedData[0];
    if (!totalField?.value) continue;

    const total = parseFloat(totalField.value.replace(/[^0-9.]/g, ""));
    if (isNaN(total)) continue;

    const existingMatch = await prisma.invoiceMatch.findFirst({
      where: { invoiceId: invoice.id, matchType: "caja_chica" },
    });

    if (total < threshold) {
      if (!existingMatch) {
        await prisma.invoiceMatch.create({
          data: {
            invoiceId: invoice.id,
            matchType: "caja_chica",
            matchedBy: "system",
            approvalStatus: "pending",
          },
        });
        created++;
      }
    } else {
      // Remove pending caja_chica match so it flows to PO matching
      if (existingMatch && existingMatch.approvalStatus === "pending") {
        await prisma.invoiceMatch.delete({ where: { id: existingMatch.id } });
        removed++;
      }
    }
  }

  return NextResponse.json({ created, removed, threshold });
}

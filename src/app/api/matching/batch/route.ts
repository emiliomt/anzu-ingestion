import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { suggestMatch } from "@/lib/matcher";
import { getSettings } from "@/lib/app-settings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  // Find invoices that have been extracted but have no confirmed match
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["extracted", "reviewed", "complete"] },
      invoiceMatches: { none: { isConfirmed: true } },
    },
    select: { id: true, referenceNo: true, organizationId: true },
    take: 20, // process up to 20 at a time
  });

  const results: { invoiceId: string; referenceNo: string; status: string; matchType?: string; confidence?: number }[] = [];

  for (const inv of invoices) {
    try {
      const result = await suggestMatch(inv.id);
      const settings = await getSettings(inv.organizationId ?? null);
      const autoConfirmThreshold = settings.auto_approve_threshold;
      const shouldAutoConfirm =
        autoConfirmThreshold !== null &&
        result.matchType !== "unmatched" &&
        result.confidence >= autoConfirmThreshold;

      if (result.matchType !== "unmatched") {
        // Upsert suggestion. Auto-confirm when confidence meets configured threshold.
        const existing = await prisma.invoiceMatch.findFirst({
          where: { invoiceId: inv.id, isConfirmed: false },
        });

        if (existing) {
          await prisma.invoiceMatch.update({
            where: { id: existing.id },
            data: {
              matchType: result.matchType,
              projectId: result.matchType === "project" ? result.matchId : null,
              purchaseOrderId: result.matchType === "purchase_order" ? result.matchId : null,
              cajaChicaId: result.matchType === "caja_chica" ? result.matchId : null,
              confidence: result.confidence,
              reasoning: result.reasoning,
              matchedBy: "ai",
              matchedAt: new Date(),
              isConfirmed: shouldAutoConfirm,
              confirmedBy: shouldAutoConfirm ? "ai:auto-threshold" : null,
              confirmedAt: shouldAutoConfirm ? new Date() : null,
            },
          });
        } else {
          await prisma.invoiceMatch.create({
            data: {
              invoiceId: inv.id,
              matchType: result.matchType,
              projectId: result.matchType === "project" ? result.matchId : null,
              purchaseOrderId: result.matchType === "purchase_order" ? result.matchId : null,
              cajaChicaId: result.matchType === "caja_chica" ? result.matchId : null,
              confidence: result.confidence,
              reasoning: result.reasoning,
              matchedBy: "ai",
              isConfirmed: shouldAutoConfirm,
              confirmedBy: shouldAutoConfirm ? "ai:auto-threshold" : null,
              confirmedAt: shouldAutoConfirm ? new Date() : null,
            },
          });
        }
      }

      results.push({
        invoiceId: inv.id,
        referenceNo: inv.referenceNo,
        status: "ok",
        matchType: result.matchType,
        confidence: result.confidence,
      });
    } catch {
      results.push({ invoiceId: inv.id, referenceNo: inv.referenceNo, status: "error" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

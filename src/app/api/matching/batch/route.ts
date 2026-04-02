import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { suggestMatch } from "@/lib/matcher";
import { withPlanFeature } from "@/lib/plan-guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function _POST(_req: NextRequest) {
  // Find invoices that have been extracted but have no confirmed match
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: ["extracted", "reviewed", "complete"] },
      invoiceMatches: { none: { isConfirmed: true } },
    },
    select: { id: true, referenceNo: true },
    take: 20, // process up to 20 at a time
  });

  const results: { invoiceId: string; referenceNo: string; status: string; matchType?: string; confidence?: number }[] = [];

  for (const inv of invoices) {
    try {
      const result = await suggestMatch(inv.id);

      if (result.matchType !== "unmatched") {
        // Upsert unconfirmed suggestion
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
              isConfirmed: false,
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

export const POST = withPlanFeature("matching", _POST);

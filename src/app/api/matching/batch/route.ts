import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { suggestMatch } from "@/lib/matcher";
import { getSettings } from "@/lib/app-settings";
import { boostMatchConfidence, normalizeConfidence } from "@/lib/matching-confidence";
import { requireOrgId } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const orgId = await requireOrgId();
    const orgScope = { OR: [{ organizationId: orgId }, { organizationId: null }] };

    // Find invoices that have been extracted but have no confirmed match
    const invoices = await prisma.invoice.findMany({
      where: {
        ...orgScope,
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
        const baseConfidence = normalizeConfidence(result.confidence);
        const matchedConfidence =
          result.matchType !== "unmatched"
            ? boostMatchConfidence(baseConfidence)
            : baseConfidence;
        const shouldAutoConfirm =
          autoConfirmThreshold !== null &&
          result.matchType !== "unmatched" &&
          matchedConfidence >= autoConfirmThreshold;
        const confidenceToStore =
          result.matchType !== "unmatched"
            ? boostMatchConfidence(baseConfidence, { isConfirmed: shouldAutoConfirm })
            : baseConfidence;

        const existing = await prisma.invoiceMatch.findFirst({
          where: { invoiceId: inv.id, isConfirmed: false },
        });

        if (existing && result.matchType === "unmatched") {
          await prisma.invoiceMatch.delete({ where: { id: existing.id } });
        } else if (result.matchType !== "unmatched") {
          // Upsert suggestion. Auto-confirm when confidence meets configured threshold.
          if (existing) {
            await prisma.invoiceMatch.update({
              where: { id: existing.id },
              data: {
                matchType: result.matchType,
                projectId: result.matchType === "project" ? result.matchId : null,
                purchaseOrderId: result.matchType === "purchase_order" ? result.matchId : null,
                cajaChicaId: result.matchType === "caja_chica" ? result.matchId : null,
                confidence: confidenceToStore,
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
                confidence: confidenceToStore,
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
          confidence: confidenceToStore,
        });
      } catch {
        results.push({ invoiceId: inv.id, referenceNo: inv.referenceNo, status: "error" });
      }
    }

    return NextResponse.json({ processed: results.length, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Batch matching failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

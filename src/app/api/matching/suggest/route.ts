import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { suggestMatch } from "@/lib/matcher";
import { getSettings } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { invoiceId } = await request.json() as { invoiceId: string };
  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId required" }, { status: 400 });
  }

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { organizationId: true },
    });
    if (!invoice) {
      return NextResponse.json({ error: "invoice not found" }, { status: 404 });
    }

    const settings = await getSettings(invoice.organizationId ?? null);
    const autoConfirmThreshold = settings.auto_approve_threshold;
    const result = await suggestMatch(invoiceId);
    const shouldAutoConfirm =
      autoConfirmThreshold !== null &&
      result.matchType !== "unmatched" &&
      result.confidence >= autoConfirmThreshold;

    // Upsert suggestion in DB. Auto-confirm when confidence meets configured threshold.
    const existing = await prisma.invoiceMatch.findFirst({
      where: { invoiceId, isConfirmed: false },
    });

    if (existing) {
      await prisma.invoiceMatch.update({
        where: { id: existing.id },
        data: {
          matchType: result.matchType === "unmatched" ? "project" : result.matchType,
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
    } else if (result.matchType !== "unmatched") {
      await prisma.invoiceMatch.create({
        data: {
          invoiceId,
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

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { suggestMatch } from "@/lib/matcher";
import { withPlanFeature } from "@/lib/plan-guard";

export const dynamic = "force-dynamic";

async function _POST(request: NextRequest) {
  const { invoiceId } = await request.json() as { invoiceId: string };
  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId required" }, { status: 400 });
  }

  try {
    const result = await suggestMatch(invoiceId);

    // Upsert suggestion (unconfirmed) in DB
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
          isConfirmed: false,
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
          isConfirmed: false,
        },
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const POST = withPlanFeature("matching", _POST);

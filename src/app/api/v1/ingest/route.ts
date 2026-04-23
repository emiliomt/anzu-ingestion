import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { suggestMatch } from "@/lib/matcher";
import { getSettings } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

interface ForwardedInvoicePayload {
  invoice_id?: string;
}

interface ForwardedSecurityPayload {
  passed?: boolean;
}

interface ForwardRequestBody {
  invoice?: ForwardedInvoicePayload;
  security?: ForwardedSecurityPayload;
}

function isAuthorized(request: NextRequest): boolean {
  const matcherApiKey = process.env.MATCHER_API_KEY?.trim();
  if (!matcherApiKey) return true;

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  return token === matcherApiKey;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as ForwardRequestBody;
  const invoiceId = body.invoice?.invoice_id;

  if (!invoiceId) {
    return NextResponse.json({ error: "invoice.invoice_id is required" }, { status: 400 });
  }

  if (body.security && body.security.passed === false) {
    return NextResponse.json(
      { ok: true, action: "skipped", reason: "security check did not pass" },
      { status: 200 }
    );
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, referenceNo: true, organizationId: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: "invoice not found" }, { status: 404 });
  }

  const confirmedMatch = await prisma.invoiceMatch.findFirst({
    where: { invoiceId: invoice.id, isConfirmed: true },
    select: { id: true },
  });
  if (confirmedMatch) {
    return NextResponse.json({
      ok: true,
      action: "already_confirmed",
      invoiceId: invoice.id,
      referenceNo: invoice.referenceNo,
      matchId: confirmedMatch.id,
    });
  }

  const result = await suggestMatch(invoice.id);
  if (result.matchType === "unmatched") {
    return NextResponse.json({
      ok: true,
      action: "no_match",
      invoiceId: invoice.id,
      referenceNo: invoice.referenceNo,
      result,
    });
  }

  const settings = await getSettings(invoice.organizationId ?? null);
  const autoConfirmThreshold = settings.auto_approve_threshold;
  const shouldAutoConfirm =
    autoConfirmThreshold !== null &&
    result.confidence >= autoConfirmThreshold;

  const existing = await prisma.invoiceMatch.findFirst({
    where: { invoiceId: invoice.id, isConfirmed: false },
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
        matchedBy: "security-forward",
        matchedAt: new Date(),
        isConfirmed: shouldAutoConfirm,
        confirmedBy: shouldAutoConfirm ? "ai:auto-threshold" : null,
        confirmedAt: shouldAutoConfirm ? new Date() : null,
      },
    });
  } else {
    await prisma.invoiceMatch.create({
      data: {
        invoiceId: invoice.id,
        matchType: result.matchType,
        projectId: result.matchType === "project" ? result.matchId : null,
        purchaseOrderId: result.matchType === "purchase_order" ? result.matchId : null,
        cajaChicaId: result.matchType === "caja_chica" ? result.matchId : null,
        confidence: result.confidence,
        reasoning: result.reasoning,
        matchedBy: "security-forward",
        isConfirmed: shouldAutoConfirm,
        confirmedBy: shouldAutoConfirm ? "ai:auto-threshold" : null,
        confirmedAt: shouldAutoConfirm ? new Date() : null,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    action: shouldAutoConfirm ? "matched_and_auto_confirmed" : "matched_pending_review",
    invoiceId: invoice.id,
    referenceNo: invoice.referenceNo,
    result,
  });
}

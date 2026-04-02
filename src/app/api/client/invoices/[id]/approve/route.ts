/**
 * POST /api/client/invoices/[id]/approve
 * ─────────────────────────────────────────────────────────────────────────────
 * CLIENT (or ADMIN) approves a provider-submitted invoice.
 * Invoice must be in `pending_approval` status and belong to the client's org.
 *
 * Transitions: pending_approval → reviewed
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionContext, writeAuditLog } from "@/lib/auth";
import { sendInvoiceApprovedEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role === "PROVIDER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  // Tenant check — ADMIN can approve any org's invoice
  if (ctx.role !== "ADMIN") {
    if (!invoice.organizationId || invoice.organizationId !== ctx.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (invoice.status !== "pending_approval") {
    return NextResponse.json(
      { error: `Cannot approve invoice with status '${invoice.status}'` },
      { status: 409 }
    );
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: "reviewed", reviewedBy: ctx.clerkUserId },
  });

  // Log event in ingestion timeline
  await prisma.ingestionEvent.create({
    data: {
      invoiceId: id,
      eventType: "approved",
      metadata: JSON.stringify({ approvedBy: ctx.clerkUserId }),
    },
  });

  await writeAuditLog(ctx, "invoice.approve", "Invoice", id);

  // Notify provider
  if (invoice.submittedBy) {
    await sendInvoiceApprovedEmail({
      to: invoice.submittedBy,
      referenceNo: invoice.referenceNo,
      orgName: ctx.organization?.name ?? "Your client",
    }).catch((e) => console.error("[approve] Email failed:", e));
  }

  return NextResponse.json({ invoice: updated });
}

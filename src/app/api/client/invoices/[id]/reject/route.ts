/**
 * POST /api/client/invoices/[id]/reject
 * ─────────────────────────────────────────────────────────────────────────────
 * CLIENT (or ADMIN) rejects a provider-submitted invoice.
 * Invoice must be in `pending_approval` status and belong to the client's org.
 *
 * Body: { reason: string }
 * Transitions: pending_approval → error (with flag "client_rejected")
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionContext, writeAuditLog } from "@/lib/auth";
import { sendInvoiceRejectedEmail } from "@/lib/email";
import { safeJsonParse } from "@/lib/utils";
import { z } from "zod";

export const dynamic = "force-dynamic";

const RejectSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required").max(500),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role === "PROVIDER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = RejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation failed" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

  if (ctx.role !== "ADMIN") {
    if (!invoice.organizationId || invoice.organizationId !== ctx.organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (invoice.status !== "pending_approval") {
    return NextResponse.json(
      { error: `Cannot reject invoice with status '${invoice.status}'` },
      { status: 409 }
    );
  }

  const existingFlags = safeJsonParse<string[]>(invoice.flags, []);
  const newFlags = JSON.stringify(Array.from(new Set(existingFlags.concat("client_rejected"))));

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      status: "error",
      flags: newFlags,
      rejectionReason: parsed.data.reason,
    },
  });

  await prisma.ingestionEvent.create({
    data: {
      invoiceId: id,
      eventType: "rejected",
      metadata: JSON.stringify({ rejectedBy: ctx.clerkUserId, reason: parsed.data.reason }),
    },
  });

  await writeAuditLog(ctx, "invoice.reject", "Invoice", id, { reason: parsed.data.reason });

  // Notify provider
  if (invoice.submittedBy) {
    await sendInvoiceRejectedEmail({
      to: invoice.submittedBy,
      referenceNo: invoice.referenceNo,
      orgName: ctx.organization?.name ?? "Your client",
      reason: parsed.data.reason,
    }).catch((e) => console.error("[reject] Email failed:", e));
  }

  return NextResponse.json({ invoice: updated });
}

/**
 * POST /api/invoices/mark-paid
 * Body: { invoiceId: string; paidAt?: string }  (paidAt defaults to now)
 * Admin-only: marks an invoice as paid and records the timestamp.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { invoiceId?: string; paidAt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { invoiceId, paidAt } = body;
  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
  }

  const date = paidAt ? new Date(paidAt) : new Date();
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid paidAt date" }, { status: 400 });
  }

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { paidAt: date, status: "complete" },
    select: { id: true, referenceNo: true, paidAt: true, status: true },
  });

  await prisma.ingestionEvent.create({
    data: {
      invoiceId,
      eventType: "paid",
      metadata: JSON.stringify({ paidAt: date.toISOString(), markedBy: userId }),
    },
  });

  return NextResponse.json(updated);
}

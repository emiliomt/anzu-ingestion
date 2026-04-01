import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;
  if (!email) {
    return NextResponse.json({ error: "No email on account" }, { status: 400 });
  }

  const invoices = await prisma.invoice.findMany({
    where: { submittedBy: email },
    orderBy: { submittedAt: "desc" },
    take: 200,
    select: {
      id:           true,
      referenceNo:  true,
      channel:      true,
      status:       true,
      fileName:     true,
      submittedAt:  true,
      processedAt:  true,
      paidAt:       true,
      flags:        true,
      extractedData: {
        where: { fieldName: { in: ["vendor_name", "total", "currency", "invoice_number"] } },
        select: { fieldName: true, value: true },
      },
    },
  });

  const data = invoices.map((inv) => {
    const fields: Record<string, string | null> = Object.fromEntries(
      inv.extractedData.map((f) => [f.fieldName, f.value])
    );
    const submittedMs = inv.submittedAt.getTime();
    const paidMs      = inv.paidAt?.getTime();
    const nowMs       = Date.now();
    const daysSinceSubmission = Math.floor((nowMs - submittedMs) / 86_400_000);
    const daysToPaid = paidMs != null
      ? Math.floor((paidMs - submittedMs) / 86_400_000)
      : null;

    return {
      id:           inv.id,
      referenceNo:  inv.referenceNo,
      channel:      inv.channel,
      status:       inv.status,
      fileName:     inv.fileName,
      submittedAt:  inv.submittedAt.toISOString(),
      processedAt:  inv.processedAt?.toISOString() ?? null,
      paidAt:       inv.paidAt?.toISOString()       ?? null,
      flags:        safeJsonParse<string[]>(inv.flags, []),
      vendorName:   fields.vendor_name     ?? null,
      invoiceNumber: fields.invoice_number ?? null,
      total:        fields.total           ?? null,
      currency:     fields.currency        ?? null,
      daysSinceSubmission,
      daysToPaid,
    };
  });

  return NextResponse.json({ email, invoices: data });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // pending | approved | rejected | assigned

  const [matches, allMatches] = await Promise.all([
    prisma.invoiceMatch.findMany({
      where: {
        matchType: "caja_chica",
        ...(status ? { approvalStatus: status } : {}),
      },
      orderBy: { matchedAt: "desc" },
      include: {
        invoice: {
          include: {
            vendor: { select: { name: true } },
            extractedData: {
              where: { fieldName: { in: ["total", "currency", "vendor_name", "invoice_date"] } },
            },
          },
        },
        cajaChica: { select: { id: true, name: true } },
      },
    }),
    prisma.invoiceMatch.findMany({
      where: { matchType: "caja_chica" },
      include: {
        invoice: {
          include: { extractedData: { where: { fieldName: "total" } } },
        },
      },
    }),
  ]);

  const stats = {
    total: allMatches.length,
    pending: allMatches.filter((m) => m.approvalStatus === "pending").length,
    approved: allMatches.filter((m) => m.approvalStatus === "approved").length,
    rejected: allMatches.filter((m) => m.approvalStatus === "rejected").length,
    assigned: allMatches.filter((m) => m.approvalStatus === "assigned").length,
    totalValue: allMatches.reduce((sum, m) => {
      const totalField = m.invoice.extractedData[0];
      if (!totalField?.value) return sum;
      const v = parseFloat(totalField.value.replace(/[^0-9.]/g, ""));
      return isNaN(v) ? sum : sum + v;
    }, 0),
  };

  return NextResponse.json({
    stats,
    invoices: matches.map((m) => {
      const fields: Record<string, string> = {};
      for (const f of m.invoice.extractedData) {
        if (f.value) fields[f.fieldName] = f.value;
      }
      return {
        matchId: m.id,
        invoiceId: m.invoice.id,
        referenceNo: m.invoice.referenceNo,
        vendorName: fields["vendor_name"] ?? m.invoice.vendor?.name ?? null,
        total: fields["total"] ?? null,
        currency: fields["currency"] ?? null,
        invoiceDate: fields["invoice_date"] ?? null,
        submittedAt: m.invoice.submittedAt.toISOString(),
        approvalStatus: m.approvalStatus,
        fundName: m.cajaChica?.name ?? null,
        fundId: m.cajaChica?.id ?? null,
      };
    }),
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json() as { matchId: string; approvalStatus: string; cajaChicaId?: string };
  if (!body.matchId || !body.approvalStatus) {
    return NextResponse.json({ error: "matchId and approvalStatus required" }, { status: 400 });
  }

  const valid = ["pending", "approved", "rejected", "assigned"];
  if (!valid.includes(body.approvalStatus)) {
    return NextResponse.json({ error: "invalid approvalStatus" }, { status: 400 });
  }

  const match = await prisma.invoiceMatch.update({
    where: { id: body.matchId },
    data: {
      approvalStatus: body.approvalStatus,
      ...(body.cajaChicaId ? { cajaChicaId: body.cajaChicaId } : {}),
      ...((body.approvalStatus === "approved" || body.approvalStatus === "assigned")
        ? { isConfirmed: true, confirmedAt: new Date() }
        : {}),
    },
  });

  return NextResponse.json({ id: match.id });
}

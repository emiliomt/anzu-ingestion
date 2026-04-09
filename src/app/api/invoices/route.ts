// Anzu Dynamics — Invoice List & Batch Delete API (tenant-scoped)
// GET    /api/invoices — paginated invoice list, filtered by org
// DELETE /api/invoices — batch delete by IDs (admin only)

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/utils";
import { requireAdmin, RoleError } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const rawPage  = parseInt(searchParams.get("page")  ?? "1");
  const rawLimit = parseInt(searchParams.get("limit") ?? "25");
  const page     = Number.isFinite(rawPage)  && rawPage  >= 1 ? rawPage  : 1;
  const limit    = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 100) : 25;
  const search   = searchParams.get("search")  ?? "";
  const status   = searchParams.get("status")  ?? "";
  const channel  = searchParams.get("channel") ?? "";
  const flagged  = searchParams.get("flagged") === "true";
  const skip     = (page - 1) * limit;

  // Resolve current org — filter by org if available, else show all (legacy single-tenant)
  const { orgId } = await auth();

  // ── Build where clause ────────────────────────────────────────────────────────
  const where: Record<string, unknown> = orgId
    ? { organizationId: orgId }
    : {};

  if (status)  where.status  = status;
  if (channel) where.channel = channel;
  if (flagged) where.NOT = { flags: "[]" };

  if (search) {
    where.OR = [
      { referenceNo:    { contains: search, mode: "insensitive" } },
      { fileName:       { contains: search, mode: "insensitive" } },
      { submittedBy:    { contains: search, mode: "insensitive" } },
      { submittedName:  { contains: search, mode: "insensitive" } },
      { vendor:         { name: { contains: search, mode: "insensitive" } } },
      {
        extractedData: {
          some: {
            fieldName: "invoice_number",
            value: { contains: search, mode: "insensitive" },
          },
        },
      },
    ];
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { submittedAt: "desc" },
      skip,
      take: limit,
      include: {
        vendor: { select: { name: true } },
        extractedData: {
          select: { fieldName: true, value: true, confidence: true },
        },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  const formatted = invoices.map((inv) => {
    const totalField = inv.extractedData.find((f) => f.fieldName === "total");
    const currField  = inv.extractedData.find((f) => f.fieldName === "currency");
    const totalNum   = totalField?.value != null ? Number(totalField.value) : NaN;

    const confValues = inv.extractedData
      .map((f) => f.confidence)
      .filter((c): c is number => c != null);
    const avgConfidence =
      confValues.length > 0
        ? Math.round((confValues.reduce((a, b) => a + b, 0) / confValues.length) * 100)
        : null;

    return {
      id:           inv.id,
      referenceNo:  inv.referenceNo,
      channel:      inv.channel,
      status:       inv.status,
      fileName:     inv.fileName,
      submittedBy:  inv.submittedBy,
      submittedName: inv.submittedName,
      submittedAt:  inv.submittedAt.toISOString(),
      isDuplicate:  inv.isDuplicate,
      flags:        safeJsonParse<string[]>(inv.flags, []),
      vendorName:   inv.vendor?.name ?? null,
      totalAmount:
        !isNaN(totalNum) && currField?.value
          ? `${currField.value} ${totalNum.toFixed(2)}`
          : !isNaN(totalNum)
          ? totalNum.toFixed(2)
          : null,
      confidence: avgConfidence,
    };
  });

  return NextResponse.json({
    invoices: formatted,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

/** Batch delete invoices — admin only, scoped to current org */
export async function DELETE(request: NextRequest) {
  try {
    const { orgId } = await requireAdmin();

    const body = (await request.json()) as { ids: string[] };
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }

    // Only delete invoices belonging to the current org
    const where = orgId
      ? { id: { in: body.ids }, organizationId: orgId }
      : { id: { in: body.ids } };

    const { count } = await prisma.invoice.deleteMany({ where });

    return NextResponse.json({ success: true, deleted: count });
  } catch (err) {
    if (err instanceof RoleError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[invoices DELETE]", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}

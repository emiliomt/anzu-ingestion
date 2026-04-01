import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/utils";
import { getSessionContext, getTenantFilter, unauthorized, forbidden } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Tenant-scoped: CLIENT sees only their org; ADMIN sees all
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  if (ctx.role === "PROVIDER") return forbidden("Providers cannot access this endpoint");

  const { searchParams } = new URL(request.url);

  const rawPage = parseInt(searchParams.get("page") ?? "1");
  const rawLimit = parseInt(searchParams.get("limit") ?? "25");
  // Clamp to safe ranges — prevents division-by-zero (limit=0 → Infinity pages)
  // and negative skip values (page<1) that produce wrong Prisma results.
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, 100) : 25;
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";
  const channel = searchParams.get("channel") ?? "";
  const flagged = searchParams.get("flagged") === "true";
  const skip = (page - 1) * limit;

  // Build where clause — always inject tenant filter
  const tenantFilter = getTenantFilter(ctx);
  const where: Record<string, unknown> = { ...tenantFilter };

  if (status) where.status = status;
  if (channel) where.channel = channel;
  if (flagged) {
    // Flag filter: flags field contains at least one flag
    // SQLite doesn't support JSON array queries so we check if the JSON string is not empty array
    where.NOT = { flags: "[]" };
  }

  if (search) {
    where.OR = [
      { referenceNo: { contains: search } },
      { fileName: { contains: search } },
      { submittedBy: { contains: search } },
      { submittedName: { contains: search } },
      {
        vendor: {
          name: { contains: search },
        },
      },
      {
        extractedData: {
          some: {
            fieldName: "invoice_number",
            value: { contains: search },
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
    const currField = inv.extractedData.find((f) => f.fieldName === "currency");
    // Parse once and guard against NaN — Claude may return non-numeric strings like "N/A"
    const totalNum = totalField?.value != null ? Number(totalField.value) : NaN;

    // Avg confidence across all extracted fields that have a confidence value
    const confValues = inv.extractedData
      .map((f) => f.confidence)
      .filter((c): c is number => c != null);
    const avgConfidence = confValues.length > 0
      ? Math.round(confValues.reduce((a, b) => a + b, 0) / confValues.length * 100)
      : null;

    return {
      id: inv.id,
      referenceNo: inv.referenceNo,
      channel: inv.channel,
      status: inv.status,
      fileName: inv.fileName,
      submittedBy: inv.submittedBy,
      submittedName: inv.submittedName,
      submittedAt: inv.submittedAt.toISOString(),
      isDuplicate: inv.isDuplicate,
      flags: safeJsonParse<string[]>(inv.flags, []),
      vendorName: inv.vendor?.name ?? null,
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
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

/** Batch delete invoices by IDs (CLIENT + ADMIN, scoped to tenant) */
export async function DELETE(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  if (ctx.role === "PROVIDER") return forbidden("Providers cannot delete invoices");

  const body = await request.json() as { ids: string[] };
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }

  // Scope delete to the caller's tenant for safety
  const tenantFilter = getTenantFilter(ctx);
  const { count } = await prisma.invoice.deleteMany({
    where: { id: { in: body.ids }, ...tenantFilter },
  });

  return NextResponse.json({ success: true, deleted: count });
}

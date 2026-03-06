import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "25");
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";
  const channel = searchParams.get("channel") ?? "";
  const flagged = searchParams.get("flagged") === "true";
  const skip = (page - 1) * limit;

  // Build where clause
  const where: Record<string, unknown> = {};

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
          where: { fieldName: { in: ["total", "currency", "invoice_number"] } },
          select: { fieldName: true, value: true },
        },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  const formatted = invoices.map((inv) => {
    const totalField = inv.extractedData.find((f) => f.fieldName === "total");
    const currField = inv.extractedData.find((f) => f.fieldName === "currency");

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
        totalField?.value && currField?.value
          ? `${currField.value} ${Number(totalField.value).toFixed(2)}`
          : totalField?.value
          ? `${Number(totalField.value).toFixed(2)}`
          : null,
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

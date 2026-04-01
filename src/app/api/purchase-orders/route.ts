import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionContext, getTenantFilter, unauthorized, forbidden } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  if (ctx.role === "PROVIDER") return forbidden("Providers cannot access purchase orders");

  const tenantFilter = getTenantFilter(ctx);
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const projectId = searchParams.get("projectId");
  const q = searchParams.get("q");

  const pos = await prisma.purchaseOrder.findMany({
    where: {
      ...tenantFilter,
      ...(status ? { status } : {}),
      ...(projectId ? { projectId } : {}),
      ...(q
        ? {
            OR: [
              { poNumber: { contains: q } },
              { vendorName: { contains: q } },
              { description: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { name: true } },
      _count: { select: { invoiceMatches: true } },
    },
  });

  return NextResponse.json(
    pos.map((po) => ({
      id: po.id,
      poNumber: po.poNumber,
      projectId: po.projectId,
      projectName: po.project?.name ?? null,
      vendorId: po.vendorId,
      vendorName: po.vendorName,
      vendorTaxId: po.vendorTaxId,
      description: po.description,
      source: po.source,
      fileUrl: po.fileUrl,
      totalAmount: po.totalAmount,
      currency: po.currency,
      issueDate: po.issueDate?.toISOString() ?? null,
      expiryDate: po.expiryDate?.toISOString() ?? null,
      status: po.status,
      createdAt: po.createdAt.toISOString(),
      updatedAt: po.updatedAt.toISOString(),
      _count: po._count,
    }))
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    poNumber: string;
    projectId?: string;
    vendorId?: string;
    vendorName?: string;
    vendorTaxId?: string;
    description?: string;
    totalAmount?: number;
    currency?: string;
    issueDate?: string;
    expiryDate?: string;
    status?: string;
    source?: string;
    fileUrl?: string;
    ocrText?: string;
  };

  if (!body.poNumber?.trim()) {
    return NextResponse.json({ error: "poNumber is required" }, { status: 400 });
  }

  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber: body.poNumber.trim(),
      projectId: body.projectId || null,
      vendorId: body.vendorId || null,
      vendorName: body.vendorName?.trim() || null,
      vendorTaxId: body.vendorTaxId?.trim() || null,
      description: body.description?.trim() || null,
      source: body.source ?? "manual",
      fileUrl: body.fileUrl ?? null,
      ocrText: body.ocrText ?? null,
      totalAmount: body.totalAmount ?? null,
      currency: body.currency ?? "COP",
      issueDate: body.issueDate ? new Date(body.issueDate) : null,
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      status: body.status ?? "open",
    },
  });

  return NextResponse.json({ id: po.id }, { status: 201 });
}

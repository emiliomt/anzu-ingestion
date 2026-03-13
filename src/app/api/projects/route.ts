import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");

  const projects = await prisma.project.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { code: { contains: q } },
              { city: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { purchaseOrders: true, invoiceMatches: true } },
    },
  });

  return NextResponse.json(
    projects.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      address: p.address,
      city: p.city,
      budget: p.budget,
      currency: p.currency,
      status: p.status,
      description: p.description,
      startDate: p.startDate?.toISOString() ?? null,
      endDate: p.endDate?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      _count: p._count,
    }))
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    name: string;
    code?: string;
    address?: string;
    city?: string;
    budget?: number;
    currency?: string;
    status?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      name: body.name.trim(),
      code: body.code?.trim() || null,
      address: body.address?.trim() || null,
      city: body.city?.trim() || null,
      budget: body.budget ?? null,
      currency: body.currency ?? "COP",
      status: body.status ?? "active",
      description: body.description?.trim() || null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
    },
  });

  return NextResponse.json({ id: project.id }, { status: 201 });
}

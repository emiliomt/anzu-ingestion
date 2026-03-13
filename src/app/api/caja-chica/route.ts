import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const funds = await prisma.cajaChica.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { invoiceMatches: true } } },
  });

  return NextResponse.json(
    funds.map((cc) => ({
      id: cc.id,
      name: cc.name,
      period: cc.period,
      balance: cc.balance,
      currency: cc.currency,
      status: cc.status,
      createdAt: cc.createdAt.toISOString(),
      updatedAt: cc.updatedAt.toISOString(),
      _count: cc._count,
    }))
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    name: string;
    period?: string;
    balance?: number;
    currency?: string;
    status?: string;
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const cc = await prisma.cajaChica.create({
    data: {
      name: body.name.trim(),
      period: body.period?.trim() || null,
      balance: body.balance ?? null,
      currency: body.currency ?? "COP",
      status: body.status ?? "open",
    },
  });

  return NextResponse.json({ id: cc.id }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json() as { id: string } & Record<string, unknown>;
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const cc = await prisma.cajaChica.update({
    where: { id: body.id },
    data: {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.period !== undefined ? { period: body.period ? String(body.period) : null } : {}),
      ...(body.balance !== undefined ? { balance: body.balance !== null ? Number(body.balance) : null } : {}),
      ...(body.currency !== undefined ? { currency: String(body.currency) } : {}),
      ...(body.status !== undefined ? { status: String(body.status) } : {}),
    },
  });

  return NextResponse.json({ id: cc.id });
}

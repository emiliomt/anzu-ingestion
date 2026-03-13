import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      purchaseOrders: { orderBy: { createdAt: "desc" } },
      _count: { select: { invoiceMatches: true } },
    },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;

  const project = await prisma.project.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.code !== undefined ? { code: body.code ? String(body.code) : null } : {}),
      ...(body.address !== undefined ? { address: body.address ? String(body.address) : null } : {}),
      ...(body.city !== undefined ? { city: body.city ? String(body.city) : null } : {}),
      ...(body.budget !== undefined ? { budget: body.budget !== null ? Number(body.budget) : null } : {}),
      ...(body.currency !== undefined ? { currency: String(body.currency) } : {}),
      ...(body.status !== undefined ? { status: String(body.status) } : {}),
      ...(body.description !== undefined ? { description: body.description ? String(body.description) : null } : {}),
      ...(body.startDate !== undefined ? { startDate: body.startDate ? new Date(String(body.startDate)) : null } : {}),
      ...(body.endDate !== undefined ? { endDate: body.endDate ? new Date(String(body.endDate)) : null } : {}),
    },
  });

  return NextResponse.json({ id: project.id });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

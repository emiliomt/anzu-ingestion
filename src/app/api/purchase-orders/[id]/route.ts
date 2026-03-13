import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;

  const po = await prisma.purchaseOrder.update({
    where: { id },
    data: {
      ...(body.poNumber !== undefined ? { poNumber: String(body.poNumber) } : {}),
      ...(body.projectId !== undefined ? { projectId: body.projectId ? String(body.projectId) : null } : {}),
      ...(body.vendorId !== undefined ? { vendorId: body.vendorId ? String(body.vendorId) : null } : {}),
      ...(body.vendorName !== undefined ? { vendorName: body.vendorName ? String(body.vendorName) : null } : {}),
      ...(body.description !== undefined ? { description: body.description ? String(body.description) : null } : {}),
      ...(body.totalAmount !== undefined ? { totalAmount: body.totalAmount !== null ? Number(body.totalAmount) : null } : {}),
      ...(body.currency !== undefined ? { currency: String(body.currency) } : {}),
      ...(body.issueDate !== undefined ? { issueDate: body.issueDate ? new Date(String(body.issueDate)) : null } : {}),
      ...(body.expiryDate !== undefined ? { expiryDate: body.expiryDate ? new Date(String(body.expiryDate)) : null } : {}),
      ...(body.status !== undefined ? { status: String(body.status) } : {}),
    },
  });

  return NextResponse.json({ id: po.id });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.purchaseOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: {
    name?: string;
    prompt?: string;
    fieldType?: string;
    isActive?: boolean;
    includeInExport?: boolean;
    displayOrder?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const field = await prisma.customField.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.prompt !== undefined && { prompt: body.prompt }),
      ...(body.fieldType !== undefined && { fieldType: body.fieldType }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.includeInExport !== undefined && { includeInExport: body.includeInExport }),
      ...(body.displayOrder !== undefined && { displayOrder: body.displayOrder }),
    },
  });
  return NextResponse.json({ field });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.customField.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

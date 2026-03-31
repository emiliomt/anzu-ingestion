import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/erp-profiles/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const profile = await prisma.erpExportProfile.findUnique({
      where: { id: params.id },
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    return NextResponse.json({ profile });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/erp-profiles/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json() as {
      name?: string;
      columnMapping?: { header: string; anzuField: string | null }[];
      outputFormat?: string;
    };

    const data: Record<string, string> = {};

    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return NextResponse.json({ error: "Profile name cannot be empty" }, { status: 400 });
      }
      data.name = body.name.trim();
    }
    if (body.columnMapping !== undefined) {
      if (!Array.isArray(body.columnMapping) || body.columnMapping.length === 0) {
        return NextResponse.json({ error: "columnMapping must be a non-empty array" }, { status: 400 });
      }
      data.columnMapping = JSON.stringify(body.columnMapping);
    }
    if (body.outputFormat !== undefined) {
      data.outputFormat = body.outputFormat === "csv" ? "csv" : "xlsx";
    }

    const profile = await prisma.erpExportProfile.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json({ profile });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/erp-profiles/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.erpExportProfile.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

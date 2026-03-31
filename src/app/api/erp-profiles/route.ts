import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/erp-profiles — list all saved profiles
export async function GET() {
  try {
    const profiles = await prisma.erpExportProfile.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ profiles });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/erp-profiles — create a new profile
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      name: string;
      columnMapping: { header: string; anzuField: string | null }[];
      outputFormat: string;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Profile name is required" }, { status: 400 });
    }
    if (!Array.isArray(body.columnMapping) || body.columnMapping.length === 0) {
      return NextResponse.json({ error: "columnMapping must be a non-empty array" }, { status: 400 });
    }
    const outputFormat = body.outputFormat === "csv" ? "csv" : "xlsx";

    const profile = await prisma.erpExportProfile.create({
      data: {
        name: body.name.trim(),
        erpType: "custom",
        columnMapping: JSON.stringify(body.columnMapping),
        outputFormat,
      },
    });

    return NextResponse.json({ profile }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

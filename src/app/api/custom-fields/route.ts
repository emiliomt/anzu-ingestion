import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const fields = await prisma.customField.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ fields });
}

export async function POST(request: NextRequest) {
  let body: {
    name?: string;
    key?: string;
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

  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  // Auto-generate key from name if not provided
  const key =
    (body.key ?? "").trim() ||
    name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });

  try {
    const field = await prisma.customField.create({
      data: {
        name,
        key,
        prompt: body.prompt ?? null,
        fieldType: body.fieldType ?? "text",
        isActive: body.isActive ?? true,
        includeInExport: body.includeInExport ?? true,
        displayOrder: body.displayOrder ?? 0,
      },
    });
    return NextResponse.json({ field }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "A field with that key already exists" }, { status: 409 });
    }
    throw err;
  }
}

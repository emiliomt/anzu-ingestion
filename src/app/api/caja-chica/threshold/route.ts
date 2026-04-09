import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const THRESHOLD_KEY = "petty_cash_threshold";
const DEFAULT_THRESHOLD = 400000;

export async function GET() {
  const setting = await prisma.setting.findUnique({ where: { organizationId_key: { organizationId: "default", key: THRESHOLD_KEY } } });
  return NextResponse.json({ threshold: setting ? Number(setting.value) : DEFAULT_THRESHOLD });
}

export async function PATCH(request: NextRequest) {
  const { threshold } = await request.json() as { threshold: number };
  if (typeof threshold !== "number" || threshold < 0) {
    return NextResponse.json({ error: "invalid threshold" }, { status: 400 });
  }
  await prisma.setting.upsert({
    where: { organizationId_key: { organizationId: "default", key: THRESHOLD_KEY } },
    update: { value: String(threshold) },
    create: { organizationId: "default", key: THRESHOLD_KEY, value: String(threshold) },
  });
  return NextResponse.json({ threshold });
}

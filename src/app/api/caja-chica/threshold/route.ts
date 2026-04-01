import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { upsertGlobalSetting } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

const THRESHOLD_KEY = "petty_cash_threshold";
const DEFAULT_THRESHOLD = 400000;

export async function GET() {
  const setting = await prisma.setting.findFirst({ where: { key: THRESHOLD_KEY, organizationId: null } });
  return NextResponse.json({ threshold: setting ? Number(setting.value) : DEFAULT_THRESHOLD });
}

export async function PATCH(request: NextRequest) {
  const { threshold } = await request.json() as { threshold: number };
  if (typeof threshold !== "number" || threshold < 0) {
    return NextResponse.json({ error: "invalid threshold" }, { status: 400 });
  }
  await upsertGlobalSetting(THRESHOLD_KEY, String(threshold));
  return NextResponse.json({ threshold });
}

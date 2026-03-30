import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUSES = ["received", "processing", "extracted", "reviewed", "complete", "error"] as const;

function getDateFrom(period: string): Date | undefined {
  const now = new Date();
  if (period === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return undefined; // "all"
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "all";
  const dateFrom = getDateFrom(period);

  const where = dateFrom ? { submittedAt: { gte: dateFrom } } : {};

  const grouped = await prisma.invoice.groupBy({
    by: ["status"],
    _count: { id: true },
    where,
  });

  const statusMap: Record<string, number> = {};
  grouped.forEach((g) => { statusMap[g.status] = g._count.id; });

  const data = STATUSES.map((status) => ({
    status,
    count: statusMap[status] ?? 0,
  }));

  return NextResponse.json({ period, data });
}

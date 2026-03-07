import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [total, totalToday, byChannel, byStatus, allFlags, confidenceData] =
    await Promise.all([
      prisma.invoice.count(),
      prisma.invoice.count({ where: { submittedAt: { gte: todayStart } } }),
      prisma.invoice.groupBy({
        by: ["channel"],
        _count: { id: true },
        where: { submittedAt: { gte: todayStart } },
      }),
      prisma.invoice.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.invoice.findMany({
        select: { flags: true, isDuplicate: true },
      }),
      prisma.extractedField.aggregate({
        _avg: { confidence: true },
        where: { confidence: { not: null } },
      }),
    ]);

  const channelMap: Record<string, number> = { web: 0, email: 0, whatsapp: 0 };
  byChannel.forEach((c) => {
    channelMap[c.channel] = c._count.id;
  });

  const statusMap: Record<string, number> = {};
  byStatus.forEach((s) => {
    statusMap[s.status] = s._count.id;
  });

  const flaggedCount = allFlags.filter((inv) => {
    const flags = safeJsonParse<string[]>(inv.flags, []);
    return flags.length > 0;
  }).length;

  const duplicateCount = allFlags.filter((inv) => inv.isDuplicate).length;

  return NextResponse.json({
    total,
    totalToday,
    byChannel: channelMap,
    byStatus: statusMap,
    flagged: flaggedCount,
    duplicates: duplicateCount,
    avgConfidence: confidenceData._avg.confidence,
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    total,
    totalToday,
    byChannel,
    byStatus,
    allFlags,
    confidenceData,
    extractedByChannelRaw,
    oldestExtracted,
  ] = await Promise.all([
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
      select: { flags: true, isDuplicate: true, status: true },
    }),
    prisma.extractedField.aggregate({
      _avg: { confidence: true },
      where: { confidence: { not: null } },
    }),
    // Channel breakdown for invoices in "extracted" status (needs human review)
    prisma.invoice.groupBy({
      by: ["channel"],
      _count: { id: true },
      where: { status: "extracted" },
    }),
    // Oldest invoice awaiting review (for age calculation)
    prisma.invoice.findFirst({
      where: { status: "extracted" },
      orderBy: { submittedAt: "asc" },
      select: { submittedAt: true, flags: true },
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

  const extractedByChannel: Record<string, number> = { web: 0, email: 0, whatsapp: 0 };
  extractedByChannelRaw.forEach((c) => {
    extractedByChannel[c.channel] = c._count.id;
  });

  // Count flagged invoices among those in "extracted" status
  const extractedFlaggedCount = allFlags.filter((inv) => {
    if (inv.status !== "extracted") return false;
    const flags = safeJsonParse<string[]>(inv.flags, []);
    return flags.length > 0;
  }).length;

  return NextResponse.json({
    total,
    totalToday,
    byChannel: channelMap,
    byStatus: statusMap,
    flagged: flaggedCount,
    duplicates: duplicateCount,
    avgConfidence: confidenceData._avg.confidence,
    extractedByChannel,
    oldestExtractedAt: oldestExtracted?.submittedAt ?? null,
    extractedFlaggedCount,
  });
}

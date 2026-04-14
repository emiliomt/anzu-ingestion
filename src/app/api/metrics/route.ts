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
    byStatusToday,
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
    prisma.invoice.groupBy({
      by: ["status"],
      _count: { id: true },
      where: { submittedAt: { gte: todayStart } },
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

  const statusTodayMap: Record<string, number> = {};
  byStatusToday.forEach((s) => {
    statusTodayMap[s.status] = s._count.id;
  });

  let flaggedCount = 0;
  let duplicateCount = 0;
  let lowConfidenceCount = 0;

  const extractedByChannel: Record<string, number> = { web: 0, email: 0, whatsapp: 0 };
  extractedByChannelRaw.forEach((c) => {
    extractedByChannel[c.channel] = c._count.id;
  });

  // Count flagged invoices among those in "extracted" status
  let extractedFlaggedCount = 0;
  let extractedLowConfidenceCount = 0;
  allFlags.forEach((inv) => {
    const flags = safeJsonParse<string[]>(inv.flags, []);
    if (flags.length > 0) flaggedCount += 1;
    if (inv.isDuplicate) duplicateCount += 1;
    if (flags.includes("low_confidence")) {
      lowConfidenceCount += 1;
    }
    if (inv.status === "extracted" && flags.length > 0) {
      extractedFlaggedCount += 1;
    }
    if (inv.status === "extracted" && flags.includes("low_confidence")) {
      extractedLowConfidenceCount += 1;
    }
  });

  const successStatuses = ["extracted", "reviewed", "complete"];
  const attemptedStatuses = [...successStatuses, "error"];
  const sumStatuses = (map: Record<string, number>, keys: string[]) =>
    keys.reduce((acc, key) => acc + (map[key] ?? 0), 0);

  const successfulCount = sumStatuses(statusMap, successStatuses);
  const attemptedCount = sumStatuses(statusMap, attemptedStatuses);
  const errorCount = statusMap.error ?? 0;
  const processingCount = (statusMap.processing ?? 0) + (statusMap.received ?? 0) + (statusMap.pending ?? 0);
  const successRate = attemptedCount > 0 ? successfulCount / attemptedCount : null;

  const successfulToday = sumStatuses(statusTodayMap, successStatuses);
  const attemptedToday = sumStatuses(statusTodayMap, attemptedStatuses);
  const successRateToday = attemptedToday > 0 ? successfulToday / attemptedToday : null;

  const reviewBacklog = statusMap.extracted ?? 0;
  const reviewBacklogFlaggedRate = reviewBacklog > 0 ? extractedFlaggedCount / reviewBacklog : null;
  const oldestExtractedAgeHours = oldestExtracted
    ? Math.max(0, Math.round((Date.now() - oldestExtracted.submittedAt.getTime()) / (1000 * 60 * 60)))
    : null;

  return NextResponse.json({
    total,
    totalToday,
    byChannel: channelMap,
    byStatus: statusMap,
    byStatusToday: statusTodayMap,
    flagged: flaggedCount,
    duplicates: duplicateCount,
    lowConfidenceCount,
    extractedLowConfidenceCount,
    avgConfidence: confidenceData._avg.confidence,
    extractedByChannel,
    oldestExtractedAt: oldestExtracted?.submittedAt ?? null,
    oldestExtractedAgeHours,
    extractedFlaggedCount,
    reviewBacklog,
    reviewBacklogFlaggedRate,
    attemptedCount,
    successfulCount,
    errorCount,
    processingCount,
    successRate,
    attemptedToday,
    successfulToday,
    successRateToday,
  });
}

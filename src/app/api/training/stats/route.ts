import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionContext, unauthorized, forbidden } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/training/stats — correction statistics for the training dashboard (ADMIN only) */
export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return unauthorized();
  if (ctx.role !== "ADMIN") return forbidden("AI training data is restricted to administrators");
  const [totalCorrections, correctionsByField, invoicesWithOcr, finetune] =
    await Promise.all([
      prisma.correctionLog.count(),

      prisma.correctionLog.groupBy({
        by: ["fieldName"],
        _count: { fieldName: true },
        orderBy: { _count: { fieldName: "desc" } },
        take: 20,
      }),

      prisma.invoice.count({
        where: { ocrText: { not: null } },
      }),

      // Active fine-tune job info from settings
      prisma.setting.findMany({
        where: {
          key: { in: ["finetune_job_id", "finetune_model_id", "finetune_status"] },
        },
      }),
    ]);

  // Count invoices that have at least one correction
  const invoicesWithCorrections = await prisma.invoice.count({
    where: {
      corrections: { some: {} },
      ocrText: { not: null },
    },
  });

  const settingsMap = Object.fromEntries(finetune.map((s) => [s.key, s.value]));

  return NextResponse.json({
    totalCorrections,
    invoicesWithCorrections,
    invoicesWithOcr,
    correctionsByField: correctionsByField.map((r) => ({
      field: r.fieldName,
      count: r._count.fieldName,
    })),
    finetune: {
      jobId: settingsMap["finetune_job_id"] ?? null,
      modelId: settingsMap["finetune_model_id"] ?? null,
      status: settingsMap["finetune_status"] ?? null,
    },
  });
}

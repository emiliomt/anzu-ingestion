import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOpenAIClient } from "@/lib/openai";

export const dynamic = "force-dynamic";

/**
 * GET /api/training/status
 *
 * Polls the OpenAI fine-tuning job and updates settings:
 *   - If job succeeded → saves fine-tuned model ID (used automatically in extraction)
 *   - If job failed   → marks status as "failed"
 *   - If still running → returns current status
 */
export async function GET() {
  try {
    getOpenAIClient({ requireFilesApi: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const jobSetting = await prisma.setting.findUnique({ where: { organizationId_key: { organizationId: "default", key: "finetune_job_id" } } });
  if (!jobSetting) {
    return NextResponse.json({ status: "none", message: "No fine-tuning job has been started." });
  }

  const client = getOpenAIClient({ requireFilesApi: true });

  try {
    const job = await client.fineTuning.jobs.retrieve(jobSetting.value);

    // Map OpenAI status to our simplified status
    const statusMap: Record<string, string> = {
      validating_files: "running",
      queued: "running",
      running: "running",
      succeeded: "succeeded",
      failed: "failed",
      cancelled: "failed",
    };
    const ourStatus = statusMap[job.status] ?? job.status;

    // If succeeded, save the fine-tuned model ID for automatic use
    if (job.status === "succeeded" && job.fine_tuned_model) {
      await Promise.all([
        prisma.setting.upsert({
          where: { organizationId_key: { organizationId: "default", key: "finetune_model_id" } },
          update: { value: job.fine_tuned_model },
          create: { organizationId: "default", key: "finetune_model_id", value: job.fine_tuned_model },
        }),
        prisma.setting.upsert({
          where: { organizationId_key: { organizationId: "default", key: "finetune_status" } },
          update: { value: "succeeded" },
          create: { organizationId: "default", key: "finetune_status", value: "succeeded" },
        }),
      ]);
    }

    if (job.status === "failed" || job.status === "cancelled") {
      await prisma.setting.upsert({
        where: { organizationId_key: { organizationId: "default", key: "finetune_status" } },
        update: { value: "failed" },
        create: { organizationId: "default", key: "finetune_status", value: "failed" },
      });
    }

    return NextResponse.json({
      jobId: job.id,
      status: ourStatus,
      openaiStatus: job.status,
      fineTunedModelId: job.fine_tuned_model ?? null,
      trainedTokens: job.trained_tokens ?? null,
      createdAt: job.created_at,
      finishedAt: job.finished_at ?? null,
      error: job.error?.message ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

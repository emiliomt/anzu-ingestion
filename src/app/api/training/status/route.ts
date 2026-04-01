import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { upsertGlobalSetting } from "@/lib/app-settings";

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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
  }

  const jobSetting = await prisma.setting.findFirst({ where: { key: "finetune_job_id", organizationId: null } });
  if (!jobSetting) {
    return NextResponse.json({ status: "none", message: "No fine-tuning job has been started." });
  }

  const client = new OpenAI({ apiKey });

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
        upsertGlobalSetting("finetune_model_id", job.fine_tuned_model),
        upsertGlobalSetting("finetune_status", "succeeded"),
      ]);
    }

    if (job.status === "failed" || job.status === "cancelled") {
      await upsertGlobalSetting("finetune_status", "failed");
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

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOpenAIClient } from "@/lib/openai";

export const dynamic = "force-dynamic";

/**
 * GET /api/vat-classifier/status
 *
 * Polls the OpenAI fine-tuning job for the VAT classifier model and
 * syncs the result back to the settings table.
 *
 * Returns:
 *   { jobId, status, openaiStatus, fineTunedModelId, trainedTokens, error }
 */
export async function GET() {
  const jobSetting = await prisma.setting.findUnique({
    where: { organizationId_key: { organizationId: "default", key: "vat_classifier_job_id" } },
  });

  if (!jobSetting?.value) {
    return NextResponse.json({ jobId: null, status: null });
  }

  const jobId = jobSetting.value;

  let client;
  try {
    client = getOpenAIClient();
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  try {
    const job = await client.fineTuning.jobs.retrieve(jobId);

    const openaiStatus = job.status; // queued | running | succeeded | failed | cancelled
    const fineTunedModelId = job.fine_tuned_model ?? null;
    const trainedTokens = job.trained_tokens ?? null;
    const errorMsg = job.error?.message ?? null;

    // Map to our internal status
    let internalStatus: "running" | "succeeded" | "failed" = "running";
    if (openaiStatus === "succeeded") internalStatus = "succeeded";
    else if (openaiStatus === "failed" || openaiStatus === "cancelled") internalStatus = "failed";

    // Persist updates
    const updates: Promise<unknown>[] = [
      prisma.setting.upsert({
        where: { organizationId_key: { organizationId: "default", key: "vat_classifier_status" } },
        update: { value: internalStatus },
        create: { organizationId: "default", key: "vat_classifier_status", value: internalStatus },
      }),
    ];

    if (fineTunedModelId) {
      updates.push(
        prisma.setting.upsert({
          where: { organizationId_key: { organizationId: "default", key: "vat_classifier_model_id" } },
          update: { value: fineTunedModelId },
          create: { organizationId: "default", key: "vat_classifier_model_id", value: fineTunedModelId },
        })
      );
    }

    await Promise.all(updates);

    return NextResponse.json({
      jobId,
      status: internalStatus,
      openaiStatus,
      fineTunedModelId,
      trainedTokens,
      error: errorMsg,
    });
  } catch (err) {
    console.error("[VATClassifier Status] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

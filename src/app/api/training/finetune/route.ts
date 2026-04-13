import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatFilesApiScopeError, getOpenAIClient } from "@/lib/openai";

export const dynamic = "force-dynamic";

const MIN_EXAMPLES = 10;

/**
 * POST /api/training/finetune
 *
 * Builds the training JSONL from correction logs, uploads it to OpenAI,
 * and starts a gpt-4o-mini fine-tuning job.
 *
 * Stores the job ID in the settings table so /api/training/status can poll it.
 *
 * Requirements:
 *   - OPENAI_FULL_ACCESS_API_KEY (preferred) or OPENAI_API_KEY must be set
 *   - At least 10 invoices with ocrText + corrections (OpenAI minimum)
 */
export async function POST(_request: NextRequest) {
  let client;
  try {
    client = getOpenAIClient({ requireFilesApi: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Check for an already-running job
  const existingJob = await prisma.setting.findUnique({
    where: { organizationId_key: { organizationId: "default", key: "finetune_job_id" } },
  });
  const existingStatus = await prisma.setting.findUnique({
    where: { organizationId_key: { organizationId: "default", key: "finetune_status" } },
  });
  if (existingJob && existingStatus?.value === "running") {
    return NextResponse.json(
      { error: "A fine-tuning job is already running", jobId: existingJob.value },
      { status: 409 }
    );
  }

  // Fetch training invoices
  const invoices = await prisma.invoice.findMany({
    where: {
      ocrText: { not: null },
      corrections: { some: {} },
    },
    select: {
      ocrText: true,
      extractedData: {
        select: { fieldName: true, value: true },
      },
      lineItems: {
        select: { description: true, quantity: true, unitPrice: true, lineTotal: true, confidence: true },
      },
      corrections: {
        select: { fieldName: true, correctedValue: true },
      },
    },
  });

  if (invoices.length < MIN_EXAMPLES) {
    return NextResponse.json(
      {
        error: `Not enough training examples. Need at least ${MIN_EXAMPLES}, have ${invoices.length}.`,
        count: invoices.length,
        required: MIN_EXAMPLES,
      },
      { status: 422 }
    );
  }

  const SYSTEM_PROMPT = `You are an expert invoice OCR and structured data extraction system.
Extract all invoice fields and return them as valid JSON. Return ONLY valid JSON — no markdown, no explanation.`;

  const USER_PROMPT_PREFIX = `Analyse the invoice text below and extract all structured data.
Return ONLY valid JSON — no preamble, no markdown fences, no explanation.\n\nInvoice text:\n`;

  // Build JSONL
  const lines: string[] = [];
  for (const invoice of invoices) {
    if (!invoice.ocrText) continue;

    const correctionMap = Object.fromEntries(
      invoice.corrections.map((c) => [c.fieldName, c.correctedValue])
    );

    const correctedFields: Record<string, unknown> = {};
    for (const field of invoice.extractedData) {
      correctedFields[field.fieldName] = {
        value: Object.prototype.hasOwnProperty.call(correctionMap, field.fieldName)
          ? correctionMap[field.fieldName]
          : field.value,
        confidence: 1.0,
        is_uncertain: false,
      };
    }
    correctedFields["line_items"] = invoice.lineItems.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unit_price: li.unitPrice,
      line_total: li.lineTotal,
      confidence: li.confidence ?? 1.0,
    }));

    lines.push(
      JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: USER_PROMPT_PREFIX + invoice.ocrText },
          { role: "assistant", content: JSON.stringify(correctedFields) },
        ],
      })
    );
  }

  const jsonlContent = lines.join("\n");

  try {
    // Upload training file
    const file = await client.files.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      file: new File([jsonlContent], "training.jsonl", { type: "application/jsonl" }) as any,
      purpose: "fine-tune",
    });

    // Start fine-tuning job on gpt-4o-mini
    const job = await client.fineTuning.jobs.create({
      training_file: file.id,
      model: "gpt-4o-mini-2024-07-18",
      suffix: "anzu-invoice",
    });

    // Persist job state in settings
    await Promise.all([
      prisma.setting.upsert({
        where: { organizationId_key: { organizationId: "default", key: "finetune_job_id" } },
        update: { value: job.id },
        create: { organizationId: "default", key: "finetune_job_id", value: job.id },
      }),
      prisma.setting.upsert({
        where: { organizationId_key: { organizationId: "default", key: "finetune_status" } },
        update: { value: "running" },
        create: { organizationId: "default", key: "finetune_status", value: "running" },
      }),
      // Clear any previously trained model so we don't use it during training
      prisma.setting.deleteMany({ where: { key: "finetune_model_id" } }),
    ]);

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      trainingExamples: lines.length,
    });
  } catch (err) {
    const scopeMessage = formatFilesApiScopeError(err);
    if (scopeMessage) {
      return NextResponse.json({ error: scopeMessage }, { status: 500 });
    }
    console.error("[FineTune] Error:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

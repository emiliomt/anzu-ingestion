import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatFilesApiScopeError, getOpenAIClient } from "@/lib/openai";

export const dynamic = "force-dynamic";

const MIN_EXAMPLES = 10;

const CLASSIFY_SYSTEM = `You are an expert invoice line-item classifier with deep knowledge of construction, manufacturing, professional services, and Latin American / US / European invoice conventions.

Classify each line item description into EXACTLY ONE of:

  material   — raw materials, supplies, parts, products, goods, hardware, components, consumables
  labor      — professional services, installation, workforce, training, certifications, man-hours
  equipment  — machinery, tools, vehicles, rental equipment, scaffolding, crane, generator
  freight    — shipping, transport, delivery, logistics, import/export, customs
  overhead   — management fees, admin costs, overhead surcharges, mobilization, insurance, bonds
  tax        — taxes, duties, levies, IVA, VAT, retención, withholding, surcharges
  discount   — discounts, credits, rebates, deductions (usually negative amounts)
  other      — anything not clearly fitting the above categories

IMPORTANT:
- Use the "Invoice context" block (concept + vendor name) to resolve ambiguous descriptions.
- Return ONLY the JSON object below. No preamble, no markdown.
- Match the exact count and order of the input items.

Response format:
{
  "items": [
    { "category": "labor", "confidence": 0.95 },
    { "category": "material", "confidence": 0.88 }
  ]
}`;

/**
 * POST /api/vat-classifier/finetune
 *
 * Builds JSONL from all invoices with classified line items,
 * uploads to OpenAI Files API, and starts a gpt-4o-mini fine-tune job
 * with suffix "anzu-vat-classifier-v1".
 *
 * Persists job state in the settings table under keys:
 *   vat_classifier_job_id
 *   vat_classifier_status   (running | succeeded | failed)
 *   vat_classifier_model_id (set on success)
 */
export async function POST() {
  let client;
  try {
    client = getOpenAIClient({ requireFilesApi: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Guard: check for already-running job
  const existingStatus = await prisma.setting.findUnique({
    where: { organizationId_key: { organizationId: "default", key: "vat_classifier_status" } },
  });
  if (existingStatus?.value === "running") {
    const existingJob = await prisma.setting.findUnique({
      where: { organizationId_key: { organizationId: "default", key: "vat_classifier_job_id" } },
    });
    return NextResponse.json(
      { error: "A VAT classifier fine-tuning job is already running.", jobId: existingJob?.value },
      { status: 409 }
    );
  }

  // Load invoices with classified line items
  const invoices = await prisma.invoice.findMany({
    where: { lineItems: { some: { category: { not: null } } } },
    select: {
      id: true,
      extractedData: {
        where: { fieldName: { in: ["vendor_name", "concept"] } },
        select: { fieldName: true, value: true },
      },
      lineItems: {
        where: { category: { not: null } },
        select: { description: true, category: true },
        orderBy: { id: "asc" },
      },
    },
  });

  if (invoices.length < MIN_EXAMPLES) {
    return NextResponse.json(
      {
        error: `Not enough training examples. Need at least ${MIN_EXAMPLES} invoices with classified line items, have ${invoices.length}.`,
        count: invoices.length,
        required: MIN_EXAMPLES,
      },
      { status: 422 }
    );
  }

  // Build JSONL
  const lines: string[] = [];
  for (const invoice of invoices) {
    const fieldMap: Record<string, string> = {};
    for (const f of invoice.extractedData) {
      if (f.value) fieldMap[f.fieldName] = f.value;
    }

    const ctxLines: string[] = [];
    if (fieldMap["vendor_name"]) ctxLines.push(`Vendor: ${fieldMap["vendor_name"]}`);
    if (fieldMap["concept"]) ctxLines.push(`Invoice concept: ${fieldMap["concept"]}`);
    const contextBlock = ctxLines.length > 0 ? `Invoice context:\n${ctxLines.join("\n")}\n\n` : "";

    const items = invoice.lineItems.filter((li) => li.description && li.category);
    if (items.length === 0) continue;

    const itemsList = items
      .map((li, i) => `${i + 1}. ${li.description?.trim() ?? "(blank)"}`)
      .join("\n");

    lines.push(
      JSON.stringify({
        messages: [
          { role: "system", content: CLASSIFY_SYSTEM },
          { role: "user", content: `${contextBlock}Line items to classify:\n${itemsList}` },
          {
            role: "assistant",
            content: JSON.stringify({
              items: items.map((li) => ({ category: li.category, confidence: 1.0 })),
            }),
          },
        ],
      })
    );
  }

  if (lines.length < MIN_EXAMPLES) {
    return NextResponse.json(
      {
        error: `Only ${lines.length} usable training examples after filtering. Need at least ${MIN_EXAMPLES}.`,
        count: lines.length,
        required: MIN_EXAMPLES,
      },
      { status: 422 }
    );
  }

  const jsonlContent = lines.join("\n");

  try {
    const file = await client.files.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      file: new File([jsonlContent], "anzu-vat-classifier.jsonl", { type: "application/jsonl" }) as any,
      purpose: "fine-tune",
    });

    const job = await client.fineTuning.jobs.create({
      training_file: file.id,
      model: "gpt-4o-mini-2024-07-18",
      suffix: "anzu-vat-classifier-v1",
    });

    await Promise.all([
      prisma.setting.upsert({
        where: { organizationId_key: { organizationId: "default", key: "vat_classifier_job_id" } },
        update: { value: job.id },
        create: { organizationId: "default", key: "vat_classifier_job_id", value: job.id },
      }),
      prisma.setting.upsert({
        where: { organizationId_key: { organizationId: "default", key: "vat_classifier_status" } },
        update: { value: "running" },
        create: { organizationId: "default", key: "vat_classifier_status", value: "running" },
      }),
      prisma.setting.deleteMany({ where: { key: "vat_classifier_model_id" } }),
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
    console.error("[VATClassifier FineTune] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

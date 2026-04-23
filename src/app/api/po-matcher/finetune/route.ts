import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatFilesApiScopeError, getOpenAIClient } from "@/lib/openai";

export const dynamic = "force-dynamic";

const MIN_EXAMPLES = 10;

const SYSTEM_PROMPT = `You are a financial assistant that matches invoices to Projects, Purchase Orders (POs), or Caja Chica (petty cash) funds.

Given invoice details and lists of available Projects, Purchase Orders, and Caja Chica funds, determine the best match.

Respond ONLY with a JSON object — no markdown, no explanation outside JSON:
{
  "matchType": "purchase_order" | "project" | "caja_chica" | "unmatched",
  "matchId": "<the id from the lists above, or null if unmatched>",
  "matchLabel": "<PO number, project name, CC name, or 'No match found'>",
  "confidence": <float 0.0 to 1.0>,
  "reasoning": "<one sentence explaining the match>"
}`;

/**
 * POST /api/po-matcher/finetune
 *
 * Builds JSONL from all confirmed InvoiceMatch records, uploads to the
 * OpenAI Files API, and starts a gpt-4o-mini fine-tune job with suffix
 * "anzu-po-matcher-v1".
 *
 * Persists job state in settings under keys:
 *   po_matcher_job_id
 *   po_matcher_status   (running | succeeded | failed)
 *   po_matcher_model_id (set on success by status route)
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
    where: { organizationId_key: { organizationId: "default", key: "po_matcher_status" } },
  });
  if (existingStatus?.value === "running") {
    const existingJob = await prisma.setting.findUnique({
      where: { organizationId_key: { organizationId: "default", key: "po_matcher_job_id" } },
    });
    return NextResponse.json(
      { error: "A PO matcher fine-tuning job is already running.", jobId: existingJob?.value },
      { status: 409 }
    );
  }

  // Load confirmed matches
  const matches = await prisma.invoiceMatch.findMany({
    where: {
      OR: [{ approvalStatus: "approved" }, { isConfirmed: true }],
    },
    include: {
      invoice: {
        include: {
          vendor: true,
          extractedData: true,
          lineItems: { select: { description: true } },
        },
      },
      purchaseOrder: { include: { project: true } },
      project: true,
      cajaChica: true,
    },
    orderBy: { matchedAt: "asc" },
  });

  if (matches.length < MIN_EXAMPLES) {
    return NextResponse.json(
      {
        error: `Not enough confirmed matches. Need at least ${MIN_EXAMPLES}, have ${matches.length}. Approve more invoice matches in the Matcher module.`,
        count: matches.length,
        required: MIN_EXAMPLES,
      },
      { status: 422 }
    );
  }

  // Build JSONL (same logic as export route)
  const lines: string[] = [];

  for (const match of matches) {
    const invoice = match.invoice;
    if (!invoice) continue;

    const fieldMap: Record<string, string> = {};
    for (const f of invoice.extractedData) {
      if (f.value) fieldMap[f.fieldName] = f.value;
    }

    const poRef = fieldMap["po_reference"];

    const invoiceContext = `
INVOICE TO MATCH:
- Reference: ${invoice.referenceNo}
- Vendor: ${fieldMap["vendor_name"] ?? invoice.vendor?.name ?? "Unknown"}
- Total: ${fieldMap["total"] ?? "Unknown"} ${fieldMap["currency"] ?? ""}
- PO Reference on invoice: ${poRef ?? "None"}
- Project name on invoice: ${fieldMap["project_name"] ?? "None"}
- Project city: ${fieldMap["project_city"] ?? "None"}
- Concept: ${fieldMap["concept"] ?? "None"}
- Line items: ${invoice.lineItems.map((l) => l.description).filter(Boolean).join(", ") || "None"}
`.trim();

    let projectsContext = "  (none)";
    let posContext = "  (none)";
    let ccContext = "  (none)";

    if (match.matchType === "purchase_order" && match.purchaseOrder) {
      const po = match.purchaseOrder;
      posContext = `  - ID: ${po.id} | PO#: "${po.poNumber}" | Vendor: ${po.vendorName ?? "-"} | Amount: ${po.totalAmount ?? "-"} ${po.currency} | Project: ${po.project?.name ?? "-"}`;
    } else if (match.matchType === "project" && match.project) {
      const p = match.project;
      projectsContext = `  - ID: ${p.id} | Name: "${p.name}" | Code: ${p.code ?? "-"} | City: ${p.city ?? "-"}`;
    } else if (match.matchType === "caja_chica" && match.cajaChica) {
      const cc = match.cajaChica;
      ccContext = `  - ID: ${cc.id} | Name: "${cc.name}" | Period: ${cc.period ?? "-"} | Balance: ${cc.balance ?? "-"} ${cc.currency}`;
    }

    const userPrompt = `${invoiceContext}

AVAILABLE PROJECTS:
${projectsContext}

AVAILABLE PURCHASE ORDERS (open):
${posContext}

AVAILABLE CAJA CHICA FUNDS (open):
${ccContext}

MATCHING RULES:
1. Purchase Order match: preferred when PO number on invoice matches a PO, or when vendor + amount range strongly align.
2. Project match: use when the invoice mentions a project name/city that matches a project but has no clear PO.
3. Caja Chica: use for small miscellaneous expenses with no PO and no clear project link.
4. Unmatched: if none of the above applies with reasonable confidence.`;

    let matchLabel = "No match found";
    if (match.matchType === "purchase_order" && match.purchaseOrder) matchLabel = match.purchaseOrder.poNumber;
    else if (match.matchType === "project" && match.project) matchLabel = match.project.name;
    else if (match.matchType === "caja_chica" && match.cajaChica) matchLabel = match.cajaChica.name;

    const assistantResponse = {
      matchType: match.matchType,
      matchId: match.purchaseOrderId ?? match.projectId ?? match.cajaChicaId ?? null,
      matchLabel,
      confidence: match.confidence ?? 0.95,
      reasoning: match.reasoning ?? `Human-confirmed match to ${match.matchType}.`,
    };

    lines.push(
      JSON.stringify({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
          { role: "assistant", content: JSON.stringify(assistantResponse) },
        ],
      })
    );
  }

  if (lines.length < MIN_EXAMPLES) {
    return NextResponse.json(
      {
        error: `Only ${lines.length} usable examples after filtering. Need at least ${MIN_EXAMPLES}.`,
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
      file: new File([jsonlContent], "anzu-po-matcher.jsonl", { type: "application/jsonl" }) as any,
      purpose: "fine-tune",
    });

    const job = await client.fineTuning.jobs.create({
      training_file: file.id,
      model: "gpt-4.1-mini-2025-04-14",
      suffix: "anzu-po-matcher-v1",
    });

    await Promise.all([
      prisma.setting.upsert({
        where: { organizationId_key: { organizationId: "default", key: "po_matcher_job_id" } },
        update: { value: job.id },
        create: { organizationId: "default", key: "po_matcher_job_id", value: job.id },
      }),
      prisma.setting.upsert({
        where: { organizationId_key: { organizationId: "default", key: "po_matcher_status" } },
        update: { value: "running" },
        create: { organizationId: "default", key: "po_matcher_status", value: "running" },
      }),
      prisma.setting.deleteMany({ where: { key: "po_matcher_model_id" } }),
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
    console.error("[POMatcher FineTune] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

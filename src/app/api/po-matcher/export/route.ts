import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/po-matcher/export
 *
 * Exports PO-matching training data as JSONL (OpenAI fine-tuning format).
 *
 * Training examples are built from InvoiceMatch records where:
 *   - approvalStatus = "approved" OR isConfirmed = true
 *   (i.e. human-verified matches only)
 *
 * Each example reconstructs the same prompt that matcher.ts sends to the model
 * at inference time, so fine-tuning teaches the model the exact decision
 * boundary used in production.
 *
 * The assistant response mirrors the MatchResult JSON the model is expected
 * to produce.
 */

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

export async function GET() {
  // Load confirmed/approved invoice matches with full context
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

  if (matches.length === 0) {
    return NextResponse.json(
      {
        error:
          "No confirmed matches found. Approve or confirm invoice matches in the Matcher module first.",
      },
      { status: 404 }
    );
  }

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

    // Reconstruct the "available" context that the matcher would have shown
    // For training, we only show the matched entity (simplification that still
    // teaches the model the matching signal). A richer approach would require
    // snapshotting all open POs/projects at the time of matching — not stored.
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

    // Build the ideal assistant response from the confirmed match
    let matchLabel = "No match found";
    if (match.matchType === "purchase_order" && match.purchaseOrder) {
      matchLabel = match.purchaseOrder.poNumber;
    } else if (match.matchType === "project" && match.project) {
      matchLabel = match.project.name;
    } else if (match.matchType === "caja_chica" && match.cajaChica) {
      matchLabel = match.cajaChica.name;
    }

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

  if (lines.length === 0) {
    return NextResponse.json(
      { error: "No usable training examples could be built from confirmed matches." },
      { status: 422 }
    );
  }

  const jsonl = lines.join("\n");

  return new NextResponse(jsonl, {
    headers: {
      "Content-Type": "application/jsonl",
      "Content-Disposition": `attachment; filename="anzu-po-matcher-${Date.now()}.jsonl"`,
      "X-Exported-Count": String(lines.length),
    },
  });
}

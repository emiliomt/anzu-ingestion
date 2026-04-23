import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/vat-classifier/export
 *
 * Exports VAT/line-item classification training data as JSONL
 * (OpenAI fine-tuning format) from all LineItems that have a non-null
 * `category` field (set either by AI + human confirmation, or by admin
 * corrections via the classify route).
 *
 * Each training example:
 *   system  → CLASSIFY_SYSTEM prompt (matches classifier.ts)
 *   user    → numbered item list + invoice context block
 *   assistant → JSON { "items": [{ "category": "...", "confidence": 1.0 }] }
 *
 * Groups line items by invoice so the context block (vendor + concept)
 * is preserved per invoice, exactly as it is during live inference.
 *
 * Min 10 examples required (OpenAI minimum).
 */

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

export async function GET() {
  // Load invoices that have at least one classified line item
  const invoices = await prisma.invoice.findMany({
    where: {
      lineItems: {
        some: { category: { not: null } },
      },
    },
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

  if (invoices.length === 0) {
    return NextResponse.json(
      { error: "No classified line items found. Run the classifier on at least one invoice first." },
      { status: 404 }
    );
  }

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

    const assistantOutput = {
      items: items.map((li) => ({
        category: li.category,
        confidence: 1.0, // human-verified / AI-accepted
      })),
    };

    lines.push(
      JSON.stringify({
        messages: [
          { role: "system", content: CLASSIFY_SYSTEM },
          { role: "user", content: `${contextBlock}Line items to classify:\n${itemsList}` },
          { role: "assistant", content: JSON.stringify(assistantOutput) },
        ],
      })
    );
  }

  if (lines.length === 0) {
    return NextResponse.json(
      { error: "No usable training examples (missing descriptions or categories)." },
      { status: 422 }
    );
  }

  const jsonl = lines.join("\n");

  return new NextResponse(jsonl, {
    headers: {
      "Content-Type": "application/jsonl",
      "Content-Disposition": `attachment; filename="anzu-vat-classifier-${Date.now()}.jsonl"`,
      "X-Exported-Count": String(lines.length),
    },
  });
}

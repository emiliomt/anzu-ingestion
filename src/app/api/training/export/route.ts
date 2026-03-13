import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/training/export
 *
 * Exports correction data as a JSONL file in OpenAI fine-tuning format.
 * Each line is a training example:
 *   { messages: [ {role:"system",...}, {role:"user",...}, {role:"assistant",...} ] }
 *
 * Only invoices that have:
 *   1. Stored ocrText (needed to reconstruct the prompt)
 *   2. At least one CorrectionLog entry
 * are included.
 *
 * The corrected assistant output is built by taking all extracted fields and
 * applying the saved corrections on top.
 */
export async function GET() {
  // Fetch invoices that have both ocrText and corrections
  const invoices = await prisma.invoice.findMany({
    where: {
      ocrText: { not: null },
      corrections: { some: {} },
    },
    select: {
      id: true,
      ocrText: true,
      extractedData: {
        select: { fieldName: true, value: true, confidence: true, isUncertain: true },
      },
      lineItems: {
        select: {
          description: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          confidence: true,
        },
      },
      corrections: {
        select: { fieldName: true, correctedValue: true },
      },
    },
  });

  if (invoices.length === 0) {
    return NextResponse.json(
      { error: "No training examples available yet. Edit some invoice fields first." },
      { status: 404 }
    );
  }

  const SYSTEM_PROMPT = `You are an expert invoice OCR and structured data extraction system.
Extract all invoice fields and return them as valid JSON. Return ONLY valid JSON — no markdown, no explanation.`;

  const USER_PROMPT_PREFIX = `Analyse the invoice text below and extract all structured data.
Return ONLY valid JSON — no preamble, no markdown fences, no explanation.\n\nInvoice text:\n`;

  const lines: string[] = [];

  for (const invoice of invoices) {
    if (!invoice.ocrText) continue;

    // Build corrected field map (correction overrides original)
    const correctionMap = Object.fromEntries(
      invoice.corrections.map((c) => [c.fieldName, c.correctedValue])
    );

    // Reconstruct the corrected extraction JSON
    const correctedFields: Record<string, unknown> = {};
    for (const field of invoice.extractedData) {
      const correctedValue = Object.prototype.hasOwnProperty.call(correctionMap, field.fieldName)
        ? correctionMap[field.fieldName]
        : field.value;

      correctedFields[field.fieldName] = {
        value: correctedValue,
        confidence: 1.0, // human-verified = max confidence
        is_uncertain: false,
      };
    }

    // Include line items as-is (not correctable via UI yet)
    correctedFields["line_items"] = invoice.lineItems.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unit_price: li.unitPrice,
      line_total: li.lineTotal,
      confidence: li.confidence ?? 1.0,
    }));

    const example = {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: USER_PROMPT_PREFIX + invoice.ocrText },
        { role: "assistant", content: JSON.stringify(correctedFields) },
      ],
    };

    lines.push(JSON.stringify(example));
  }

  const jsonl = lines.join("\n");

  return new NextResponse(jsonl, {
    headers: {
      "Content-Type": "application/jsonl",
      "Content-Disposition": `attachment; filename="training-data-${Date.now()}.jsonl"`,
    },
  });
}

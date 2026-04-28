/**
 * Line item category classification — dedicated focused AI pass.
 *
 * Separated from the main extraction (claude.ts) so it can be:
 *   1. Run automatically after extraction in the upload pipeline.
 *   2. Triggered on-demand from the admin UI (re-classify button).
 *
 * The invoice `concept` and `vendor_name` fields are injected as context
 * so ambiguous descriptions (e.g. "Servicio", item codes, short refs) are
 * resolved against the overall invoice subject (e.g. "REENTRENAMIENTO DE
 * TRABAJO EN ALTURA" → labor).
 */

import type { LineItemCategory } from "@/types/invoice";
import { getOpenAIClient } from "./openai";

export type { LineItemCategory };

export interface ClassificationResult {
  category: LineItemCategory | null;
  confidence: number;
}

export class LineItemClassificationError extends Error {
  constructor(
    message: string,
    public readonly code: "api_error" | "invalid_json" | "no_valid_categories"
  ) {
    super(message);
    this.name = "LineItemClassificationError";
  }
}

// ── OpenAI client wrapper ───────────────────────────────────────────────────
function getClient() {
  return getOpenAIClient();
}

// ── System prompt ──────────────────────────────────────────────────────────
const CLASSIFY_SYSTEM = `You are an expert invoice line-item classifier with deep knowledge of construction, manufacturing, professional services, and Latin American / US / European invoice conventions.

Classify each line item description into EXACTLY ONE of:

  material   — raw materials, supplies, parts, products, goods, hardware, components, consumables
               (e.g. "acero", "concreto", "tubería", "lumber", "steel pipe", "hardware")
  labor      — professional services, installation, workforce, training, certifications, man-hours
               (e.g. "mano de obra", "instalación", "capacitación", "reentrenamiento", "consulting", "work-at-height training")
  equipment  — machinery, tools, vehicles, rental equipment, scaffolding, crane, generator
               (e.g. "alquiler grúa", "andamio", "excavator rental", "equipment lease")
  freight    — shipping, transport, delivery, logistics, import/export, customs
               (e.g. "flete", "transporte", "shipping & handling", "delivery charge")
  overhead   — management fees, admin costs, overhead surcharges, mobilization, insurance, bonds
               (e.g. "administración", "gastos generales", "overhead 10%", "mobilization")
  tax        — taxes, duties, levies, IVA, VAT, retención, withholding, surcharges
               (e.g. "IVA 19%", "retención en la fuente", "GST", "withholding tax")
  discount   — discounts, credits, rebates, deductions (usually negative amounts)
               (e.g. "descuento 5%", "credit note", "rebate", "nota crédito")
  other      — anything not clearly fitting the above categories

IMPORTANT:
- Use the "Invoice context" block (concept + vendor name) to resolve ambiguous descriptions.
  Example: if the invoice concept is "REENTRENAMIENTO TRABAJO EN ALTURA" and a line item says
  "Servicio", classify it as "labor" (not "other").
- Return ONLY the JSON object below. No preamble, no markdown.
- Match the exact count and order of the input items.

Response format:
{
  "items": [
    { "category": "labor", "confidence": 0.95 },
    { "category": "material", "confidence": 0.88 }
  ]
}`;

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Classify an array of line-item descriptions using a focused GPT-4o-mini call.
 *
 * @param descriptions  Array of description strings (null entries = blank line items).
 * @param context       Optional invoice-level context to resolve ambiguous items.
 * @returns             Array of { category, confidence } in the same order as input.
 */
export async function classifyLineItems(
  descriptions: (string | null)[],
  context: {
    concept?:    string | null;
    vendorName?: string | null;
  } = {}
): Promise<ClassificationResult[]> {
  if (descriptions.length === 0) return [];

  // Build context block
  const ctxLines: string[] = [];
  if (context.vendorName) ctxLines.push(`Vendor: ${context.vendorName}`);
  if (context.concept)    ctxLines.push(`Invoice concept: ${context.concept}`);
  const contextBlock = ctxLines.length > 0
    ? `Invoice context:\n${ctxLines.join("\n")}\n\n`
    : "";

  // Numbered list of descriptions
  const itemsList = descriptions
    .map((d, i) => `${i + 1}. ${d?.trim() || "(blank)"}`)
    .join("\n");

  const userPrompt = `${contextBlock}Line items to classify:\n${itemsList}`;

  let raw = "";
  try {
    const resp = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CLASSIFY_SYSTEM },
        { role: "user",   content: userPrompt },
      ],
    });
    raw = resp.choices[0]?.message?.content ?? "{}";
  } catch (err) {
    throw new LineItemClassificationError(
      `Classification API request failed: ${err instanceof Error ? err.message : String(err)}`,
      "api_error"
    );
  }

  // Parse response
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LineItemClassificationError(
      `Classifier returned invalid JSON: ${raw.slice(0, 200)}`,
      "invalid_json"
    );
  }

  // Support both { items: [...] } and bare array
  const arr: unknown[] = (() => {
    if (Array.isArray(parsed)) return parsed;
    const p = parsed as Record<string, unknown>;
    if (Array.isArray(p.items))           return p.items as unknown[];
    if (Array.isArray(p.results))         return p.results as unknown[];
    if (Array.isArray(p.classifications)) return p.classifications as unknown[];
    return [];
  })();

  const VALID_CATEGORIES = new Set<string>([
    "material", "labor", "equipment", "freight",
    "overhead", "tax", "discount", "other",
  ]);

  function normalizeCategory(value: unknown): LineItemCategory | null {
    if (typeof value !== "string") return null;
    const normalized = value.toLowerCase().trim();
    if (VALID_CATEGORIES.has(normalized)) return normalized as LineItemCategory;

    const aliases: Record<string, LineItemCategory> = {
      materials: "material",
      materiales: "material",
      labour: "labor",
      services: "labor",
      servicio: "labor",
      servicios: "labor",
      equipments: "equipment",
      shipping: "freight",
      transport: "freight",
      transporte: "freight",
      taxes: "tax",
      iva: "tax",
      vat: "tax",
      descuentos: "discount",
      descuento: "discount",
      others: "other",
      otro: "other",
      otros: "other",
    };
    return aliases[normalized] ?? null;
  }

  const mapped = descriptions.map((_, i) => {
    const item = arr[i] as Record<string, unknown> | undefined;
    if (!item) return { category: null, confidence: 0 };

    const cat = normalizeCategory(item.category);
    const confidence = typeof item.confidence === "number"
      ? Math.min(1, Math.max(0, item.confidence))
      : 0.8;

    return { category: cat, confidence };
  });

  const nonBlankInputCount = descriptions.filter((d) => (d?.trim() ?? "").length > 0).length;
  const nonNullCategoryCount = mapped.filter((m) => m.category !== null).length;
  if (nonBlankInputCount > 0 && nonNullCategoryCount === 0) {
    throw new LineItemClassificationError(
      "Classifier returned no valid categories for non-empty line items.",
      "no_valid_categories"
    );
  }

  return mapped;
}

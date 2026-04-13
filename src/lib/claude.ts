/**
 * Invoice AI extraction — three-path pipeline:
 *
 *   1. XML  (text/xml | application/xml)
 *      → parseInvoiceXML()  — no AI, deterministic, confidence 0.95
 *
 *   2. Image / PDF
 *      → GPT-4o vision  (OCR pass — extracts raw text only)
 *      → cleanOcrText() (8-step normalisation)
 *      → GPT-4o-mini    (structured extraction from clean text)
 *
 * The two-pass image/PDF approach costs less than a single GPT-4o
 * structured-extraction call because the OCR pass emits few tokens and
 * the extraction pass uses the much cheaper gpt-4o-mini model.
 */

import OpenAI from "openai";
import sharp from "sharp";
import { z } from "zod";
import { bufferToBase64 } from "./utils";
import { cleanOcrText } from "./ocr-cleaner";
import { parseInvoiceXML } from "./xml-parser";
import { EXTRACTION_SYSTEM_PROMPT, buildCustomFieldsSection, CustomFieldDef } from "./extraction-prompt";

// ── Extraction options (injected from app settings) ───────────────────────────
export interface ExtractionOptions {
  /** ISO 3166-1 alpha-2 fallback country if currency detection fails */
  default_country?: string;
  /** ISO 4217 fallback currency if all detection layers fail */
  default_currency?: string;
  /** "auto" | "es" | "en" | "pt" */
  document_language?: string;
  /** "auto" | "latin_american" | "us" */
  amount_format?: string;
  /** GPT-4o-mini timeout in milliseconds (default: 25 000) */
  timeout_ms?: number;
  /**
   * Called with the cleaned OCR text AFTER the OCR pass but BEFORE the
   * extraction pass.  Returns a few-shot prompt section to inject into the
   * system prompt (or "" if nothing to inject).
   * This is where vendor-aware correction examples are provided.
   */
  buildFewShot?: (ocrText: string) => Promise<string>;
  /**
   * Fine-tuned model ID to use instead of the default gpt-4o-mini.
   * Set automatically from app settings once a fine-tuning job completes.
   */
  fineTunedModelId?: string | null;
  /**
   * List of field keys to include in extraction.
   * When omitted or empty, all fields are extracted.
   */
  enabled_fields?: string[];
  /**
   * User-defined custom fields to extract alongside the standard fields.
   * Each field is injected into the system prompt with its key and prompt.
   * Extracted values are returned in InvoiceExtraction.customFields.
   */
  customFields?: CustomFieldDef[];
}

// ── OpenAI client (lazy — constructor must NOT run at Next.js build time) ─────
let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

// #region agent log
/** Session 2a885f: stdout for Railway/hosted logs; POST for local Cursor debug ingest */
function agentOcrDebugLog(entry: {
  location: string;
  message: string;
  data: Record<string, unknown>;
  hypothesisId: string;
}) {
  const payload = { sessionId: "2a885f", ...entry, timestamp: Date.now() };
  const line = JSON.stringify(payload);
  console.info("[anzu-ocr-debug]", line);
  fetch("http://127.0.0.1:7553/ingest/eedea92a-3d38-42dc-9d34-bd178f933bd4", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "2a885f" },
    body: line,
  }).catch(() => {});
}
// #endregion

const OCR_MODEL       = "gpt-4o";                    // vision — needed for image/PDF OCR
const EXTRACT_MODEL   = "gpt-4.1-mini-2025-04-14";  // text-only — cheap structured extraction
const OCR_MAX_OUTPUT_TOKENS = 16_384;
const EXTRACTION_INPUT_CHAR_LIMIT = 48_000;
const EXTRACT_MAX_OUTPUT_TOKENS = 16_384;

// ── Zod schemas ───────────────────────────────────────────────────────────────

const ExtractionFieldSchema = z.object({
  value: z.union([z.string(), z.number()]).nullable(),
  confidence: z.number().min(0).max(1),
  is_uncertain: z.boolean().optional(),
});

const LineItemCategorySchema = z.enum([
  "material", "labor", "equipment", "freight",
  "overhead", "tax", "discount", "other",
]).nullable();

const LineItemSchema = z.object({
  description: z.string().nullable(),
  quantity:    z.number().nullable(),
  unit_price:  z.number().nullable(),
  line_total:  z.number().nullable(),
  category:    LineItemCategorySchema,
  confidence:  z.number().min(0).max(1),
});

const InvoiceExtractionSchema = z.object({
  vendor_name:          ExtractionFieldSchema,
  vendor_address:       ExtractionFieldSchema,
  invoice_number:       ExtractionFieldSchema,
  issue_date:           ExtractionFieldSchema,
  due_date:             ExtractionFieldSchema,
  subtotal:             ExtractionFieldSchema,
  tax:                  ExtractionFieldSchema,
  total:                ExtractionFieldSchema,
  currency:             ExtractionFieldSchema,
  po_reference:         ExtractionFieldSchema,
  payment_terms:        ExtractionFieldSchema,
  bank_details:         ExtractionFieldSchema,
  line_items:           z.array(LineItemSchema),
  // Extended fields (optional — XML parser and enhanced extraction)
  vendor_tax_id:        ExtractionFieldSchema.optional(),
  buyer_name:           ExtractionFieldSchema.optional(),
  buyer_tax_id:         ExtractionFieldSchema.optional(),
  buyer_address:        ExtractionFieldSchema.optional(),
  concept:              ExtractionFieldSchema.optional(),
  project_name:         ExtractionFieldSchema.optional(),
  project_address:      ExtractionFieldSchema.optional(),
  project_city:         ExtractionFieldSchema.optional(),
  description_summary:  ExtractionFieldSchema.optional(),
  notes:                ExtractionFieldSchema.optional(),
});

export type InvoiceExtractionInput = z.input<typeof InvoiceExtractionSchema>;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExtractionField {
  value: string | number | null;
  confidence: number;
  is_uncertain?: boolean;
}

export type LineItemCategory =
  | "material"
  | "labor"
  | "equipment"
  | "freight"
  | "overhead"
  | "tax"
  | "discount"
  | "other";

export interface LineItemExtraction {
  description: string | null;
  quantity:    number | null;
  unit_price:  number | null;
  line_total:  number | null;
  category:    LineItemCategory | null;
  confidence:  number;
}

export interface InvoiceExtraction {
  // ── Core fields ─────────────────────────────────────────────────────────
  vendor_name:    ExtractionField;
  vendor_address: ExtractionField;
  invoice_number: ExtractionField;
  issue_date:     ExtractionField;
  due_date:       ExtractionField;
  subtotal:       ExtractionField;
  tax:            ExtractionField;
  total:          ExtractionField;
  currency:       ExtractionField;
  po_reference:   ExtractionField;
  payment_terms:  ExtractionField;
  bank_details:   ExtractionField;
  line_items:     LineItemExtraction[];

  // ── Extended fields (populated by XML parser & enhanced AI extraction) ──
  vendor_tax_id?:       ExtractionField; // NIT / RFC / CUIT of the vendor
  buyer_name?:          ExtractionField; // Adquiriente / Cliente name
  buyer_tax_id?:        ExtractionField; // NIT / RFC / CUIT of the buyer
  buyer_address?:       ExtractionField; // Buyer's full address
  concept?:             ExtractionField; // Invoice concept / subject line
  project_name?:        ExtractionField; // Obra / project name
  project_address?:     ExtractionField; // Project physical address
  project_city?:        ExtractionField; // City where project is located
  description_summary?: ExtractionField; // Summary of services rendered
  notes?:               ExtractionField; // Observations / footer notes

  /** Custom fields defined by the user — keyed by CustomField.key */
  customFields?: Record<string, ExtractionField>;
}

// ── System prompt (shared by both the OCR‑extracted path and direct path) ─────
//
// Imported from src/lib/extraction-prompt.ts so it is also available to the
// fine-tuning export route without pulling in the OpenAI client.
export { EXTRACTION_SYSTEM_PROMPT } from "./extraction-prompt";

// ── Per-field JSON schema templates ──────────────────────────────────────────
const FIELD_TEMPLATES: Record<string, string> = {
  vendor_name:     `  "vendor_name":          { "value": "string or null", "confidence": 0.0, "is_uncertain": false }`,
  vendor_address:  `  "vendor_address":       { "value": "string or null", "confidence": 0.0, "is_uncertain": false }`,
  vendor_tax_id:   `  "vendor_tax_id":        { "value": "string or null", "confidence": 0.0, "is_uncertain": false }`,
  invoice_number:  `  "invoice_number":       { "value": "string or null", "confidence": 0.0, "is_uncertain": false }`,
  issue_date:      `  "issue_date":           { "value": "YYYY-MM-DD or null", "confidence": 0.0, "is_uncertain": false }`,
  due_date:        `  "due_date":             { "value": "YYYY-MM-DD or null", "confidence": 0.0, "is_uncertain": false }`,
  subtotal:        `  "subtotal":             { "value": null, "confidence": 0.0, "is_uncertain": false }`,
  tax:             `  "tax":                  { "value": null, "confidence": 0.0, "is_uncertain": false }`,
  total:           `  "total":                { "value": null, "confidence": 0.0, "is_uncertain": false }`,
  currency:        `  "currency":             { "value": "ISO 4217 code or null", "confidence": 0.0, "is_uncertain": false }`,
  po_reference:    `  "po_reference":         { "value": "string or null", "confidence": 0.0, "is_uncertain": false }`,
  payment_terms:   `  "payment_terms":        { "value": "string or null", "confidence": 0.0, "is_uncertain": false }`,
  bank_details:    `  "bank_details":         { "value": "string or null", "confidence": 0.0, "is_uncertain": false }`,
  buyer_name:      `  "buyer_name":           { "value": "string or null", "confidence": 0.0, "is_uncertain": false }`,
  buyer_tax_id:    `  "buyer_tax_id":         { "value": "string or null", "confidence": 0.0, "is_uncertain": false }`,
  buyer_address:   `  "buyer_address":        { "value": "string or null", "confidence": 0.0, "is_uncertain": false }`,
  concept:         `  "concept":              { "value": "string or null", "confidence": 0.0, "is_uncertain": false }`,
  project_name:    `  "project_name":         { "value": "string or null", "confidence": 0.0, "is_uncertain": false }`,
  project_address: `  "project_address":      { "value": "string or null", "confidence": 0.0, "is_uncertain": false }`,
  project_city:    `  "project_city":         { "value": "string or null", "confidence": 0.0, "is_uncertain": false }`,
  notes:           `  "notes":                { "value": "string or null", "confidence": 0.0, "is_uncertain": false }`,
  line_items:      `  "line_items": [\n    {\n      "description": "string or null",\n      "quantity":    null,\n      "unit_price":  null,\n      "line_total":  null,\n      "category":    "material | labor | equipment | freight | overhead | tax | discount | other | null",\n      "confidence":  0.0\n    }\n  ]`,
};

// ── Build extraction user prompt from the enabled field list ──────────────────
function buildExtractionUserPrompt(enabledFields?: string[]): string {
  const ordered = Object.keys(FIELD_TEMPLATES);
  const active = enabledFields && enabledFields.length > 0
    ? ordered.filter((f) => enabledFields.includes(f))
    : ordered;

  const schemaLines = active.map((f) => FIELD_TEMPLATES[f]).filter(Boolean).join(",\n");

  return `Analyse the invoice text below and extract all structured data.
Return ONLY valid JSON — no preamble, no markdown fences, no explanation.

{
${schemaLines}
}

Invoice text:
`;
}

// ── OCR-only system prompt ─────────────────────────────────────────────────────
const OCR_SYSTEM_PROMPT =
  "You are an OCR engine. Extract ALL text from the invoice document exactly as it appears. " +
  "Preserve every number, date, address, table row, and label. " +
  "Do not interpret, summarise, or restructure — output only the raw visible text.";

// ── Build context footer appended to system prompt ────────────────────────────
function buildContextSection(opts: ExtractionOptions): string {
  const lines: string[] = ["", "══ DOCUMENT CONTEXT (from system settings) ═════════════════════════════════"];
  if (opts.default_country) {
    lines.push(`Default country: ${opts.default_country}`);
  }
  if (opts.default_currency) {
    lines.push(`Default currency: ${opts.default_currency} — use this if ALL detection signals above are absent or inconclusive.`);
  }
  if (opts.document_language && opts.document_language !== "auto") {
    lines.push(`Document language: ${opts.document_language}`);
  }
  if (opts.amount_format && opts.amount_format !== "auto") {
    const desc = opts.amount_format === "latin_american"
      ? "Latin American (period=thousands, comma=decimal): 1.234.567,89"
      : "US/International (comma=thousands, period=decimal): 1,234,567.89";
    lines.push(`Amount format: ${desc}`);
  }
  return lines.join("\n");
}

// ── Path 1: XML → deterministic parse ─────────────────────────────────────────
function handleXml(buffer: Buffer): InvoiceExtraction {
  const xmlText = buffer.toString("utf-8");
  return parseInvoiceXML(xmlText);
}

// ── Path 2: Image / PDF → GPT-4o OCR → clean → GPT-4o-mini extract ───────────
async function handleImageOrPdf(
  buffer: Buffer,
  mimeType: string,
  opts: ExtractionOptions = {}
): Promise<{ result: InvoiceExtraction; ocrText: string }> {
  // #region agent log
  agentOcrDebugLog({
    location: "claude.ts:handleImageOrPdf:entry",
    message: "ocr pipeline entry",
    data: {
      mimeType,
      bufferLength: buffer.length,
      byteOffset: buffer.byteOffset,
      abByteLength: buffer.buffer?.byteLength ?? null,
    },
    hypothesisId: "A",
  });
  // #endregion

  // ── Step A: Build content parts for the OCR pass ──────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ocrParts: any[] = [];
  let uploadedFileId: string | null = null;

  if (mimeType === "application/pdf") {
    const uploaded = await getClient().files.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      file: new File([new Uint8Array(buffer)], "invoice.pdf", { type: "application/pdf" }) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      purpose: "user_data" as any,
    });
    uploadedFileId = uploaded.id;
    ocrParts.push({ type: "file", file: { file_id: uploadedFileId } });
  } else {
    const needsHeicTiffRaster =
      mimeType.includes("heic") ||
      mimeType.includes("heif") ||
      mimeType.includes("tiff") ||
      mimeType.includes("tif");

    let rasterBuffer: Buffer = buffer;
    let imageType: string;
    if (needsHeicTiffRaster) {
      rasterBuffer = await sharp(buffer).rotate().jpeg({ quality: 90 }).toBuffer();
      imageType = "image/jpeg";
    } else if (mimeType.includes("png")) {
      imageType = "image/png";
    } else if (mimeType.includes("webp")) {
      imageType = "image/webp";
    } else {
      imageType = "image/jpeg";
    }

    const base64Data = bufferToBase64(rasterBuffer);

    // #region agent log
    agentOcrDebugLog({
      location: "claude.ts:handleImageOrPdf:imageUrl",
      message: "vision data-url mime vs declared file mime",
      data: {
        declaredMime: mimeType,
        dataUrlMediaType: imageType,
        base64Len: base64Data.length,
        rasterizedHeicTiff: needsHeicTiffRaster,
      },
      hypothesisId: "D",
    });
    // #endregion

    ocrParts.push({
      type: "image_url",
      image_url: {
        url: `data:${imageType};base64,${base64Data}`,
        detail: "high",
      },
    });
  }

  ocrParts.push({
    type: "text",
    text: "Extract all text from this invoice document exactly as it appears.",
  });

  // ── Step B: Call GPT-4o for OCR ───────────────────────────────────────
  let rawOcrText = "";
  let ocrFinishReason: string | null = null;
  try {
    const ocrResp = await getClient().chat.completions.create({
      model: OCR_MODEL,
      max_tokens: OCR_MAX_OUTPUT_TOKENS,
      temperature: 0,
      messages: [
        { role: "system", content: OCR_SYSTEM_PROMPT },
        { role: "user", content: ocrParts },
      ],
    });
    ocrFinishReason = ocrResp.choices[0]?.finish_reason ?? null;
    rawOcrText = ocrResp.choices[0]?.message?.content ?? "";
  } finally {
    // Clean up uploaded PDF file regardless of OCR success/failure
    if (uploadedFileId) {
      getClient().files.delete(uploadedFileId).catch(() => {});
    }
  }

  // #region agent log
  agentOcrDebugLog({
    location: "claude.ts:handleImageOrPdf:postOcr",
    message: "after OCR API",
    data: {
      rawOcrLen: rawOcrText.length,
      ocrFinishReason,
      isPdf: mimeType === "application/pdf",
    },
    hypothesisId: "B",
  });
  // #endregion

  // ── Step C: Clean the OCR text ────────────────────────────────────────
  const cleanedText = cleanOcrText(rawOcrText);

  // ── Step C2: Build few-shot examples (vendor-aware, from correction logs) ──
  let fewShotSection = "";
  if (opts.buildFewShot) {
    try {
      fewShotSection = await opts.buildFewShot(cleanedText);
    } catch {
      // Non-fatal: extraction still proceeds without few-shot examples
    }
  }

  // ── Step D: Call GPT-4o-mini for structured extraction ────────────────
  const truncatedText = cleanedText.slice(0, EXTRACTION_INPUT_CHAR_LIMIT);

  // #region agent log
  agentOcrDebugLog({
    location: "claude.ts:handleImageOrPdf:preExtract",
    message: "cleaned vs truncated text sizes",
    data: {
      cleanedLen: cleanedText.length,
      truncatedLen: truncatedText.length,
      charsDropped: Math.max(0, cleanedText.length - truncatedText.length),
    },
    hypothesisId: "C",
  });
  // #endregion

  const timeoutMs = opts.timeout_ms ?? 25_000;
  const customFieldsSection = opts.customFields && opts.customFields.length > 0
    ? buildCustomFieldsSection(opts.customFields)
    : "";
  const systemPrompt = EXTRACTION_SYSTEM_PROMPT + buildContextSection(opts) + customFieldsSection + fewShotSection;
  const extractModel = opts.fineTunedModelId ?? EXTRACT_MODEL;
  const userPrompt = buildExtractionUserPrompt(opts.enabled_fields);

  const extractResp = await Promise.race([
    getClient().chat.completions.create({
      model: extractModel,
      max_tokens: EXTRACT_MAX_OUTPUT_TOKENS,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt + truncatedText },
      ],
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`GPT-4o-mini extraction timed out after ${timeoutMs / 1000}s`)), timeoutMs)
    ),
  ]);

  const raw = extractResp.choices[0]?.message?.content ?? "";
  const extractFinishReason = extractResp.choices[0]?.finish_reason ?? null;

  // #region agent log
  agentOcrDebugLog({
    location: "claude.ts:handleImageOrPdf:postExtract",
    message: "after extraction API",
    data: {
      extractFinishReason,
      responseCharLen: raw.length,
      extractModel,
    },
    hypothesisId: "F",
  });
  // #endregion

  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let rawParsed: unknown;
  try {
    rawParsed = JSON.parse(cleaned);
  } catch {
    const hint =
      extractFinishReason === "length"
        ? " (model output was truncated — finish_reason=length)"
        : "";
    throw new Error(
      `Extraction returned invalid JSON${hint}. Raw response (prefix): ${raw.slice(0, 1200)}`
    );
  }

  const validation = InvoiceExtractionSchema.safeParse(rawParsed);
  let parsed: InvoiceExtraction;
  // #region agent log
  agentOcrDebugLog({
    location: "claude.ts:handleImageOrPdf:zod",
    message: "extraction JSON zod result",
    data: { zodOk: validation.success, issueCount: validation.success ? 0 : validation.error.issues.length },
    hypothesisId: "E",
  });
  // #endregion
  if (validation.success) {
    parsed = validation.data as InvoiceExtraction;
  } else {
    // Log schema mismatches but don't hard-fail — use the raw data so partial
    // results still reach the caller instead of crashing the upload pipeline.
    console.warn(
      "[extraction] Zod validation warnings:",
      validation.error.flatten().fieldErrors
    );
    parsed = rawParsed as InvoiceExtraction;
  }

  if (!Array.isArray(parsed.line_items)) parsed.line_items = [];

  // Extract custom field values from the raw response
  if (opts.customFields && opts.customFields.length > 0) {
    const customFieldValues: Record<string, ExtractionField> = {};
    const rawObj = rawParsed as Record<string, unknown>;
    for (const cf of opts.customFields) {
      const raw = rawObj[cf.key];
      if (raw && typeof raw === "object" && "value" in raw) {
        customFieldValues[cf.key] = raw as ExtractionField;
      } else {
        customFieldValues[cf.key] = { value: null, confidence: 0 };
      }
    }
    parsed.customFields = customFieldValues;
  }

  return { result: parsed, ocrText: cleanedText };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Extract structured data from an invoice file.
 * Backward-compatible: returns only the extraction result.
 *
 * Routing:
 *   XML                → deterministic XML parser (no AI, no cost)
 *   Image / PDF        → GPT-4o OCR → 8-step clean → GPT-4o-mini extract
 *
 * @param opts  Optional settings injected from the app Settings page.
 *              Pass `buildFewShot` to inject vendor-aware correction examples.
 */
export async function extractInvoice(
  fileBuffer: Buffer,
  mimeType: string,
  opts: ExtractionOptions = {}
): Promise<InvoiceExtraction> {
  const { result } = await extractInvoiceWithOcr(fileBuffer, mimeType, opts);
  return result;
}

/**
 * Like extractInvoice but also returns the cleaned OCR text.
 * Use this in the upload pipeline to persist ocrText for training data.
 */
export async function extractInvoiceWithOcr(
  fileBuffer: Buffer,
  mimeType: string,
  opts: ExtractionOptions = {}
): Promise<{ result: InvoiceExtraction; ocrText: string | null }> {
  const isXml =
    mimeType === "text/xml" ||
    mimeType === "application/xml" ||
    mimeType === "text/plain"; // .xml files sometimes sniff as text/plain

  if (isXml) {
    if (mimeType === "text/plain") {
      const peek = fileBuffer.slice(0, 20).toString("utf-8").trimStart();
      if (!peek.startsWith("<")) {
        return handleImageOrPdf(fileBuffer, mimeType, opts);
      }
    }
    return { result: handleXml(fileBuffer), ocrText: null };
  }

  return handleImageOrPdf(fileBuffer, mimeType, opts);
}

/**
 * Build a deduplication key from invoice number + vendor name.
 * Returns null if both are absent.
 */
export function buildDuplicateKey(
  invoiceNumber: string | null,
  vendorName: string | null
): string | null {
  if (!invoiceNumber && !vendorName) return null;
  return `${(vendorName ?? "").toLowerCase().trim()}|${(invoiceNumber ?? "").toLowerCase().trim()}`;
}

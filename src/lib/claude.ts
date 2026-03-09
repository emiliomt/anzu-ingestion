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
import { bufferToBase64 } from "./utils";
import { cleanOcrText } from "./ocr-cleaner";
import { parseInvoiceXML } from "./xml-parser";

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
}

// ── OpenAI client (lazy — constructor must NOT run at Next.js build time) ─────
let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

const OCR_MODEL       = "gpt-4o";       // vision — needed for image/PDF OCR
const EXTRACT_MODEL   = "gpt-4o-mini";  // text-only — cheap structured extraction

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExtractionField {
  value: string | number | null;
  confidence: number;
  is_uncertain?: boolean;
}

export interface LineItemExtraction {
  description: string | null;
  quantity:    number | null;
  unit_price:  number | null;
  line_total:  number | null;
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
}

// ── System prompt (shared by both the OCR‑extracted path and direct path) ─────
//
// Lives in the system role so GPT-4o-mini treats it as standing instructions
// rather than part of the document being analysed.
const EXTRACTION_SYSTEM_PROMPT = `You are an expert invoice OCR and structured data extraction system. You have deep knowledge of invoice formats from Latin America (Colombia, Mexico, Argentina, Chile, Peru, Uruguay), USA, Canada, Europe, and worldwide.

══ CURRENCY DETECTION ══════════════════════════════════════════════════════════
Currency must NEVER be null when monetary amounts exist in the document.
Work through these signals in order:

1. EXPLICIT ISO CODE — if the document says "USD", "EUR", "COP", "MXN", "ARS",
   "CLP", "BRL", "PEN", "GBP", etc., use it directly. Confidence 1.0.

2. CURRENCY WORDS
   "dólares americanos"   → USD
   "pesos colombianos"    → COP
   "pesos mexicanos"      → MXN
   "pesos argentinos"     → ARS
   "pesos chilenos"       → CLP
   "euros"                → EUR  |  "libras"  → GBP
   "reales"               → BRL  |  "soles"   → PEN
   Confidence 0.95.

3. TAX ID FORMAT → COUNTRY → CURRENCY  (very reliable)
   NIT  "900.xxx.xxx-x"   → Colombia → COP
   RFC  "XXXX999999XXX"   → Mexico   → MXN
   CUIT "XX-XXXXXXXX-X"   → Argentina → ARS
   RUT  "XX.XXX.XXX-X"    → Chile    → CLP
   RUC                    → Peru → PEN  or  Ecuador → USD
   CNPJ / CPF             → Brazil   → BRL
   EIN / FEIN             → USA      → USD
   VAT "GB…"              → UK       → GBP
   VAT "DE/FR/ES/IT…"     → EU member → EUR
   Confidence 0.90.

4. SYMBOL + ADDRESS CONTEXT
   "$" + Colombian city (Bogotá, Medellín, Cali, Barranquilla…) → COP
   "$" + Mexican city (CDMX, Monterrey, Guadalajara…)           → MXN
   "$" + Argentine city (Buenos Aires, Córdoba, Rosario…)        → ARS
   "$" + Chilean city (Santiago, Valparaíso…)                    → CLP
   "$" + US / CA city or state                                   → USD
   "€" → EUR  |  "£" → GBP
   Confidence 0.80.

5. AMOUNT MAGNITUDE (last resort)
   Amounts > 100,000 with "$" and no US/CA address → likely Latin American peso
   (COP most common). Confidence 0.65, set is_uncertain: true.

══ NUMBER FORMAT RULES ══════════════════════════════════════════════════════════
Latin American and European invoices use DIFFERENT separators than the US:
  "1.200.000"       → 1200000      (period = thousands)
  "1.200.000,00"    → 1200000.00   (period = thousands, comma = decimal)
  "1.250,50"        → 1250.50      (European: comma = decimal)
  "1,250.50"        → 1250.50      (US: comma = thousands)
Always return amounts as plain JS numbers. No commas, no symbols, no strings.

══ CONFIDENCE SCORING ═══════════════════════════════════════════════════════════
1.00  Field explicitly and clearly present, no ambiguity
0.95  Clearly present, very minor OCR uncertainty
0.85  Present but required minor inference          → is_uncertain: false
0.75  Inferred from strong contextual signals       → is_uncertain: false
0.65  Inferred from weak/indirect signals           → is_uncertain: true
<0.65 Highly uncertain or speculative               → is_uncertain: true

══ FIELD-SPECIFIC RULES ═════════════════════════════════════════════════════════
vendor_name:     Company/person ISSUING the invoice (not the buyer).
vendor_address:  Full address of the vendor including city and country if present.
vendor_tax_id:   NIT / RFC / CUIT / RUC of the VENDOR (issuing party).
invoice_number:  "Factura No.", "Invoice #", "No. Factura", "Nro.", "Número".
                 CUFE, CUDE, UUID (long hex strings) are NOT invoice numbers.
issue_date:      Date the invoice was created. ISO format YYYY-MM-DD.
due_date:        Payment deadline. Return null if not explicitly stated.
subtotal:        Amount before tax. Return null if only the total is shown.
tax:             IVA / VAT / GST / impuesto amount as a number.
total:           Grand total. "TOTAL", "Total a Pagar", "Total Factura".
po_reference:    "O.C.", "Orden de Compra", "P.O.", "PO#".
payment_terms:   e.g. "Net 30", "Contado", "30 días", "Pago inmediato".
bank_details:    Concatenate bank name, account number, routing, IBAN into one string.
buyer_name:      Name of the BUYER / Adquiriente / Cliente (not the vendor).
buyer_tax_id:    NIT / RFC / CUIT of the buyer.
buyer_address:   Full address of the buyer.
concept:         Brief summary of what the invoice is for (first line of services).
project_name:    Obra / proyecto / project name if mentioned.
project_address: Physical address of the project / obra.
project_city:    City where the project is located.
notes:           Observations, payment notes, or footer text.`;

// ── Extraction JSON schema (user prompt) ──────────────────────────────────────
const EXTRACTION_USER_PROMPT = `Analyse the invoice text below and extract all structured data.
Return ONLY valid JSON — no preamble, no markdown fences, no explanation.

{
  "vendor_name":          { "value": "string or null", "confidence": 0.0, "is_uncertain": false },
  "vendor_address":       { "value": "string or null", "confidence": 0.0, "is_uncertain": false },
  "vendor_tax_id":        { "value": "string or null", "confidence": 0.0, "is_uncertain": false },
  "invoice_number":       { "value": "string or null", "confidence": 0.0, "is_uncertain": false },
  "issue_date":           { "value": "YYYY-MM-DD or null", "confidence": 0.0, "is_uncertain": false },
  "due_date":             { "value": "YYYY-MM-DD or null", "confidence": 0.0, "is_uncertain": false },
  "subtotal":             { "value": null, "confidence": 0.0, "is_uncertain": false },
  "tax":                  { "value": null, "confidence": 0.0, "is_uncertain": false },
  "total":                { "value": null, "confidence": 0.0, "is_uncertain": false },
  "currency":             { "value": "ISO 4217 code or null", "confidence": 0.0, "is_uncertain": false },
  "po_reference":         { "value": "string or null", "confidence": 0.0, "is_uncertain": false },
  "payment_terms":        { "value": "string or null", "confidence": 0.0, "is_uncertain": false },
  "bank_details":         { "value": "string or null", "confidence": 0.0, "is_uncertain": false },
  "buyer_name":           { "value": "string or null", "confidence": 0.0, "is_uncertain": false },
  "buyer_tax_id":         { "value": "string or null", "confidence": 0.0, "is_uncertain": false },
  "buyer_address":        { "value": "string or null", "confidence": 0.0, "is_uncertain": false },
  "concept":              { "value": "string or null", "confidence": 0.0, "is_uncertain": false },
  "project_name":         { "value": "string or null", "confidence": 0.0, "is_uncertain": false },
  "project_address":      { "value": "string or null", "confidence": 0.0, "is_uncertain": false },
  "project_city":         { "value": "string or null", "confidence": 0.0, "is_uncertain": false },
  "notes":                { "value": "string or null", "confidence": 0.0, "is_uncertain": false },
  "line_items": [
    {
      "description": "string or null",
      "quantity":    null,
      "unit_price":  null,
      "line_total":  null,
      "confidence":  0.0
    }
  ]
}

Invoice text:
`;

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
): Promise<InvoiceExtraction> {
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
    const base64Data = bufferToBase64(buffer.buffer as ArrayBuffer);
    const imageType = mimeType.includes("png")
      ? "image/png"
      : mimeType.includes("webp")
      ? "image/webp"
      : "image/jpeg";

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
  try {
    const ocrResp = await getClient().chat.completions.create({
      model: OCR_MODEL,
      max_tokens: 2048,
      temperature: 0,
      messages: [
        { role: "system", content: OCR_SYSTEM_PROMPT },
        { role: "user", content: ocrParts },
      ],
    });
    rawOcrText = ocrResp.choices[0]?.message?.content ?? "";
  } finally {
    // Clean up uploaded PDF file regardless of OCR success/failure
    if (uploadedFileId) {
      getClient().files.delete(uploadedFileId).catch(() => {});
    }
  }

  // ── Step C: Clean the OCR text ────────────────────────────────────────
  const cleanedText = cleanOcrText(rawOcrText);

  // ── Step D: Call GPT-4o-mini for structured extraction ────────────────
  // Truncate to 4000 chars to stay within token budget
  const truncatedText = cleanedText.slice(0, 4000);

  const timeoutMs = opts.timeout_ms ?? 25_000;
  const systemPrompt = EXTRACTION_SYSTEM_PROMPT + buildContextSection(opts);

  const extractResp = await Promise.race([
    getClient().chat.completions.create({
      model: EXTRACT_MODEL,
      max_tokens: 1500,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: EXTRACTION_USER_PROMPT + truncatedText },
      ],
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`GPT-4o-mini extraction timed out after ${timeoutMs / 1000}s`)), timeoutMs)
    ),
  ]);

  const raw = extractResp.choices[0]?.message?.content ?? "";
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let parsed: InvoiceExtraction;
  try {
    parsed = JSON.parse(cleaned) as InvoiceExtraction;
  } catch {
    throw new Error(
      `GPT-4o-mini returned invalid JSON. Raw response: ${raw.slice(0, 500)}`
    );
  }

  if (!Array.isArray(parsed.line_items)) parsed.line_items = [];
  return parsed;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Extract structured data from an invoice file.
 *
 * Routing:
 *   XML                → deterministic XML parser (no AI, no cost)
 *   Image / PDF        → GPT-4o OCR → 8-step clean → GPT-4o-mini extract
 *
 * @param opts  Optional settings injected from the app Settings page
 *              (default_country, default_currency, document_language,
 *              amount_format, timeout_ms).  If omitted, sensible defaults apply.
 */
export async function extractInvoice(
  fileBuffer: Buffer,
  mimeType: string,
  opts: ExtractionOptions = {}
): Promise<InvoiceExtraction> {
  const isXml =
    mimeType === "text/xml" ||
    mimeType === "application/xml" ||
    mimeType === "text/plain"; // .xml files sometimes sniff as text/plain

  if (isXml) {
    // For text/plain we do a quick sanity check — if it starts with '<' it's XML
    if (mimeType === "text/plain") {
      const peek = fileBuffer.slice(0, 20).toString("utf-8").trimStart();
      if (!peek.startsWith("<")) {
        // Real plain-text (rare edge case) — fall through to AI path
        return handleImageOrPdf(fileBuffer, mimeType, opts);
      }
    }
    return handleXml(fileBuffer);
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

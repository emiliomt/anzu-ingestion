import OpenAI from "openai";
import { bufferToBase64 } from "./utils";

// Lazy-initialize so the constructor doesn't run at build time
// (OPENAI_API_KEY is only available at runtime, not during `next build`)
let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

const MODEL = "gpt-4o";

export interface ExtractionField {
  value: string | number | null;
  confidence: number;
  is_uncertain?: boolean;
}

export interface LineItemExtraction {
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  line_total: number | null;
  confidence: number;
}

export interface InvoiceExtraction {
  vendor_name: ExtractionField;
  vendor_address: ExtractionField;
  invoice_number: ExtractionField;
  issue_date: ExtractionField;
  due_date: ExtractionField;
  subtotal: ExtractionField;
  tax: ExtractionField;
  total: ExtractionField;
  currency: ExtractionField;
  po_reference: ExtractionField;
  payment_terms: ExtractionField;
  bank_details: ExtractionField;
  line_items: LineItemExtraction[];
}

// ─── System prompt ────────────────────────────────────────────────────────────
// Kept in the system role so GPT-4o treats it as standing instructions rather
// than part of the document being analysed. This significantly improves
// instruction-following and confidence calibration.
const SYSTEM_PROMPT = `You are an expert invoice OCR and structured data extraction system. You have deep knowledge of invoice formats from Latin America (Colombia, Mexico, Argentina, Chile, Peru, Uruguay), USA, Canada, Europe, and worldwide.

══ CURRENCY DETECTION ════════════════════════════════════════════════
Currency must NEVER be null when monetary amounts exist in the document.
Work through these signals in order:

1. EXPLICIT ISO CODE — if the document says "USD", "EUR", "COP", "MXN", "ARS", "CLP", "BRL", "PEN", "GBP", etc., use it directly. Confidence 1.0.

2. CURRENCY WORDS
   "dólares americanos" → USD
   "pesos colombianos" / "pesos" (Colombia) → COP
   "pesos mexicanos" / "pesos" (Mexico) → MXN
   "pesos argentinos" / "pesos" (Argentina) → ARS
   "pesos chilenos" / "pesos" (Chile) → CLP
   "euros" → EUR   "libras" → GBP   "reales" → BRL   "soles" → PEN
   Confidence 0.95.

3. TAX ID FORMAT → COUNTRY → CURRENCY (very reliable)
   NIT format "900.xxx.xxx-x" or "xxx.xxx.xxx-x" → Colombia → COP
   RFC format "XXXX999999XXX" → Mexico → MXN
   CUIT/CUIL "XX-XXXXXXXX-X" → Argentina → ARS
   RUT "XX.XXX.XXX-X" → Chile → CLP
   RUC → Peru → PEN or Ecuador → USD
   CNPJ/CPF → Brazil → BRL
   EIN/SSN/FEIN → USA → USD
   VAT "GB..." → UK → GBP
   VAT "DE/FR/ES/IT..." → EU → EUR
   Confidence 0.90.

4. SYMBOL + ADDRESS CONTEXT
   "$" + Colombian city (Bogotá, Medellín, Cali, Barranquilla…) → COP
   "$" + Mexican city (CDMX, Monterrey, Guadalajara…) → MXN
   "$" + Argentine city (Buenos Aires, Córdoba, Rosario…) → ARS
   "$" + Chilean city (Santiago, Valparaíso…) → CLP
   "$" + US city / state → USD
   "€" → EUR   "£" → GBP
   Confidence 0.80.

5. AMOUNT MAGNITUDE HEURISTIC (last resort, low confidence)
   Amounts > 100,000 with "$" and no US/CA address → likely Latin American peso (COP most common)
   Confidence 0.65, set is_uncertain: true.

══ NUMBER FORMAT RULES ══════════════════════════════════════════════
Latin American and European invoices use DIFFERENT separators than US:
  "1.200.000"       → 1200000   (period = thousands separator)
  "1.200.000,00"    → 1200000   (period = thousands, comma = decimal)
  "107.100"         → 107100    (if context suggests large currency like COP)
  "1.250,50"        → 1250.50   (European: comma = decimal)
  "1,250.50"        → 1250.50   (US: comma = thousands, period = decimal)
Always return amounts as plain JS numbers (no commas, no symbols, no strings).
When in doubt about separators, use the currency and country context.

══ CONFIDENCE SCORING ═══════════════════════════════════════════════
1.00  Field is explicitly and clearly present, no ambiguity
0.95  Field clearly present, very minor OCR uncertainty
0.85  Field present but required minor inference
0.75  Field inferred from strong contextual signals → is_uncertain: false
0.65  Field inferred from weak/indirect signals     → is_uncertain: true
<0.65 Very uncertain or speculative                → is_uncertain: true

══ FIELD-SPECIFIC RULES ═════════════════════════════════════════════
vendor_name:     Company/person ISSUING the invoice (not the buyer/client)
vendor_address:  Full address of the vendor including city, country if present
invoice_number:  Look for "Factura No.", "Invoice #", "No. Factura", "Nro.", "Número".
                 CUFE, CUDE, UUID are NOT the invoice number — ignore them.
issue_date:      Date invoice was created/issued. ISO format YYYY-MM-DD.
due_date:        Payment due date. If not explicitly stated, return null.
subtotal:        Amount before tax. If only total is shown, return null for subtotal.
tax:             IVA / VAT / GST amount as a number. Look for "IVA 19%", "IVA", "Tax".
total:           Grand total. Look for "TOTAL", "Total a Pagar", "Total Factura".
bank_details:    Concatenate all payment info: bank name, account number, routing, IBAN, etc.
po_reference:    Purchase order number. Look for "O.C.", "Orden de Compra", "P.O.", "PO#".
payment_terms:   e.g. "Net 30", "Contado", "30 días", "Pago inmediato".
line_items:      Extract ALL rows from itemised tables. Include service descriptions.`;

// ─── User prompt ──────────────────────────────────────────────────────────────
// Short and structural — the heavy lifting is in the system prompt above.
const USER_PROMPT = `Analyse this invoice document and extract all structured data.
Return ONLY valid JSON matching this exact schema — no preamble, no markdown fences:

{
  "vendor_name":    { "value": "string or null", "confidence": 0.0, "is_uncertain": false },
  "vendor_address": { "value": "string or null", "confidence": 0.0, "is_uncertain": false },
  "invoice_number": { "value": "string or null", "confidence": 0.0, "is_uncertain": false },
  "issue_date":     { "value": "YYYY-MM-DD or null", "confidence": 0.0, "is_uncertain": false },
  "due_date":       { "value": "YYYY-MM-DD or null", "confidence": 0.0, "is_uncertain": false },
  "subtotal":       { "value": null, "confidence": 0.0, "is_uncertain": false },
  "tax":            { "value": null, "confidence": 0.0, "is_uncertain": false },
  "total":          { "value": null, "confidence": 0.0, "is_uncertain": false },
  "currency":       { "value": "ISO 4217 code or null", "confidence": 0.0, "is_uncertain": false },
  "po_reference":   { "value": "string or null", "confidence": 0.0, "is_uncertain": false },
  "payment_terms":  { "value": "string or null", "confidence": 0.0, "is_uncertain": false },
  "bank_details":   { "value": "string or null", "confidence": 0.0, "is_uncertain": false },
  "line_items": [
    {
      "description": "string or null",
      "quantity":    null,
      "unit_price":  null,
      "line_total":  null,
      "confidence":  0.0
    }
  ]
}`;

/**
 * Extract structured data from an invoice file (image or PDF).
 * Returns a typed InvoiceExtraction object.
 */
export async function extractInvoice(
  fileBuffer: Buffer,
  mimeType: string
): Promise<InvoiceExtraction> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentParts: any[] = [];
  let uploadedFileId: string | null = null;

  if (mimeType === "application/pdf") {
    // PDFs must be uploaded to the OpenAI Files API first, then referenced by ID
    const uploaded = await getClient().files.create({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      file: new File([new Uint8Array(fileBuffer)], "invoice.pdf", { type: "application/pdf" }) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      purpose: "user_data" as any,
    });
    uploadedFileId = uploaded.id;
    contentParts.push({ type: "file", file: { file_id: uploadedFileId } });
  } else {
    // Images: send as base64 data URL via the vision API
    const base64Data = bufferToBase64(fileBuffer.buffer as ArrayBuffer);
    const imageType = mimeType.includes("png")
      ? "image/png"
      : mimeType.includes("webp")
      ? "image/webp"
      : "image/jpeg";

    contentParts.push({
      type: "image_url",
      image_url: {
        url: `data:${imageType};base64,${base64Data}`,
        detail: "high",
      },
    });
  }

  // Document content first, then the extraction instruction
  contentParts.push({ type: "text", text: USER_PROMPT });

  try {
    const response = await getClient().chat.completions.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        // System message carries the standing extraction rules —
        // GPT-4o follows these much more reliably than inline instructions
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contentParts },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";

    // Strip any accidental markdown fences then parse
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed: InvoiceExtraction;
    try {
      parsed = JSON.parse(cleaned) as InvoiceExtraction;
    } catch {
      throw new Error(
        `OpenAI returned invalid JSON. Raw response: ${text.slice(0, 500)}`
      );
    }

    // Ensure line_items is always an array
    if (!Array.isArray(parsed.line_items)) {
      parsed.line_items = [];
    }

    return parsed;
  } finally {
    // Clean up the uploaded PDF file (non-fatal if this fails)
    if (uploadedFileId) {
      getClient().files.delete(uploadedFileId).catch(() => {});
    }
  }
}

/**
 * Detect if a new invoice is a duplicate of an existing one.
 * Uses invoice number + vendor name hashing.
 */
export function buildDuplicateKey(
  invoiceNumber: string | null,
  vendorName: string | null
): string | null {
  if (!invoiceNumber && !vendorName) return null;
  const combined = `${(vendorName ?? "").toLowerCase().trim()}|${(invoiceNumber ?? "").toLowerCase().trim()}`;
  return combined;
}

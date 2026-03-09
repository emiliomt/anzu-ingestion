import OpenAI from "openai";
import { bufferToBase64 } from "./utils";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

const EXTRACTION_PROMPT = `You are an expert invoice data extraction system. Extract all structured data from the provided invoice document.

Return ONLY valid JSON with this exact structure (no preamble, no explanation, no markdown):
{
  "vendor_name": { "value": "string or null", "confidence": 0.0-1.0, "is_uncertain": false },
  "vendor_address": { "value": "string or null", "confidence": 0.0-1.0, "is_uncertain": false },
  "invoice_number": { "value": "string or null", "confidence": 0.0-1.0, "is_uncertain": false },
  "issue_date": { "value": "YYYY-MM-DD or null", "confidence": 0.0-1.0, "is_uncertain": false },
  "due_date": { "value": "YYYY-MM-DD or null", "confidence": 0.0-1.0, "is_uncertain": false },
  "subtotal": { "value": number or null, "confidence": 0.0-1.0, "is_uncertain": false },
  "tax": { "value": number or null, "confidence": 0.0-1.0, "is_uncertain": false },
  "total": { "value": number or null, "confidence": 0.0-1.0, "is_uncertain": false },
  "currency": { "value": "USD|EUR|GBP|etc or null", "confidence": 0.0-1.0, "is_uncertain": false },
  "po_reference": { "value": "string or null", "confidence": 0.0-1.0, "is_uncertain": false },
  "payment_terms": { "value": "string or null", "confidence": 0.0-1.0, "is_uncertain": false },
  "bank_details": { "value": "string or null", "confidence": 0.0-1.0, "is_uncertain": false },
  "line_items": [
    {
      "description": "string or null",
      "quantity": number or null,
      "unit_price": number or null,
      "line_total": number or null,
      "confidence": 0.0-1.0
    }
  ]
}

Rules:
- Return null for any field not found in the document — NEVER hallucinate values
- Set is_uncertain: true for fields that are ambiguous or hard to read
- Confidence scores reflect how certain you are (1.0 = certain, 0.0 = no idea)
- Dates must be ISO format: YYYY-MM-DD
- Amounts must be numbers (not strings), e.g. 1250.00 not "$1,250.00"
- line_items is an empty array [] if no line items are found`;

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
    const uploaded = await client.files.create({
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

  contentParts.push({ type: "text", text: EXTRACTION_PROMPT });

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: contentParts }],
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
      client.files.delete(uploadedFileId).catch(() => {});
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

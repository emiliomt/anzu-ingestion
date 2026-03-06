import Anthropic from "@anthropic-ai/sdk";
import { bufferToBase64, toAnthropicMediaType } from "./utils";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-6";

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
  const base64Data = bufferToBase64(fileBuffer.buffer as ArrayBuffer);
  const anthropicMediaType = toAnthropicMediaType(mimeType);

  // Build the content block — PDF uses document type, images use image type
  type ContentBlock =
    | {
        type: "image";
        source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string };
      }
    | {
        type: "document";
        source: { type: "base64"; media_type: "application/pdf"; data: string };
      }
    | { type: "text"; text: string };

  let fileContent: ContentBlock;

  if (anthropicMediaType === "application/pdf") {
    fileContent = {
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: base64Data,
      },
    };
  } else {
    fileContent = {
      type: "image",
      source: {
        type: "base64",
        media_type: anthropicMediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: base64Data,
      },
    };
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          fileContent,
          {
            type: "text",
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((c) => c.type === "text")
    .map((c) => (c as { type: "text"; text: string }).text)
    .join("");

  // Parse the JSON response — strip any accidental markdown fences
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  let parsed: InvoiceExtraction;
  try {
    parsed = JSON.parse(cleaned) as InvoiceExtraction;
  } catch {
    throw new Error(
      `Claude returned invalid JSON. Raw response: ${text.slice(0, 500)}`
    );
  }

  // Ensure line_items is always an array
  if (!Array.isArray(parsed.line_items)) {
    parsed.line_items = [];
  }

  return parsed;
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

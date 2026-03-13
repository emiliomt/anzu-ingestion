/**
 * POST /api/purchase-orders/extract
 *
 * Accepts a PO document (PDF or image) and uses Claude vision to extract
 * structured fields for pre-filling the PO form.
 */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { storeFile } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUPPORTED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const SYSTEM_PROMPT = `You are a purchase order data extractor. Given a PO document image or PDF,
extract the following fields and return ONLY a valid JSON object with no markdown, no explanation.

Fields to extract:
- po_number: string | null         (PO / Order Number / Número de OC)
- vendor_name: string | null       (Supplier / Vendor name)
- vendor_tax_id: string | null     (NIT / RUT / Tax ID of the vendor)
- total_amount: number | null      (Total amount, numeric only, no currency symbols)
- currency: string | null          (ISO 4217 code e.g. COP, USD, EUR)
- issue_date: string | null        (ISO date YYYY-MM-DD)
- expiry_date: string | null       (Expiry / delivery date, ISO YYYY-MM-DD)
- description: string | null       (Short description of what is being purchased)
- project_name: string | null      (Project or obra name if mentioned)
- payment_terms: string | null     (e.g. "30 days", "Net 60", "Contado")
- line_items: Array<{description: string, quantity: number|null, unit_price: number|null, line_total: number|null}> | []

Return ONLY the JSON object. Example:
{"po_number":"OC-2025-001","vendor_name":"Aceros del Norte S.A.S.","vendor_tax_id":"900123456-7","total_amount":5000000,"currency":"COP","issue_date":"2025-01-15","expiry_date":null,"description":"Compra de varillas de acero","project_name":"Torre Norte","payment_terms":"30 días","line_items":[]}`;

interface ExtractedPO {
  po_number: string | null;
  vendor_name: string | null;
  vendor_tax_id: string | null;
  total_amount: number | null;
  currency: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  description: string | null;
  project_name: string | null;
  payment_terms: string | null;
  line_items: Array<{
    description: string;
    quantity: number | null;
    unit_price: number | null;
    line_total: number | null;
  }>;
}

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Failed to parse multipart form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";
  if (!SUPPORTED_MIME.has(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${mimeType}. Supported: PDF, PNG, JPG, WEBP` },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Store the file
  const stored = await storeFile(buffer, file.name, mimeType, "po");

  // Build Claude message
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let content: Anthropic.MessageParam["content"];

  if (mimeType === "application/pdf") {
    content = [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: buffer.toString("base64"),
        },
      } as Anthropic.DocumentBlockParam,
      { type: "text", text: "Extract all purchase order fields from this document." },
    ];
  } else {
    content = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: buffer.toString("base64"),
        },
      },
      { type: "text", text: "Extract all purchase order fields from this document." },
    ];
  }

  let response;
  try {
    response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `AI extraction failed: ${msg}` }, { status: 502 });
  }

  const raw = response.content[0].type === "text" ? response.content[0].text : "";

  let extracted: ExtractedPO;
  try {
    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    extracted = JSON.parse(cleaned) as ExtractedPO;
  } catch {
    return NextResponse.json(
      { error: "Failed to parse extraction result", raw },
      { status: 422 }
    );
  }

  return NextResponse.json({
    extracted,
    fileUrl: stored.url,
    fileName: file.name,
    mimeType,
  });
}

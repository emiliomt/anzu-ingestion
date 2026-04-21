/**
 * POST /api/purchase-orders/extract
 *
 * Accepts a PO document (PDF or image) and uses GPT-4o vision to extract
 * structured fields for pre-filling the PO form.
 */
import { NextRequest, NextResponse } from "next/server";
import { formatFilesApiScopeError, getOpenAIClient } from "@/lib/openai";
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
  try {
    getOpenAIClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
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

  const baseClient = mimeType === "application/pdf"
    ? getOpenAIClient({ requireFilesApi: true })
    : getOpenAIClient();
  const filesClient = baseClient;

  // Build GPT-4o message — PDFs uploaded via Files API, images as base64
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userContent: any[] = [];
  let uploadedFileId: string | null = null;

  if (mimeType === "application/pdf") {
    try {
      const uploaded = await filesClient.files.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        file: new File([new Uint8Array(buffer)], file.name, { type: "application/pdf" }) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        purpose: "user_data" as any,
      });
      uploadedFileId = uploaded.id;
      userContent.push({ type: "file", file: { file_id: uploadedFileId } });
    } catch (err) {
      const scopeMessage = formatFilesApiScopeError(err);
      if (scopeMessage) {
        return NextResponse.json({ error: scopeMessage }, { status: 500 });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `PDF upload failed: ${msg}` }, { status: 502 });
    }
  } else {
    const imageType = mimeType.includes("png")
      ? "image/png"
      : mimeType.includes("webp")
      ? "image/webp"
      : mimeType.includes("gif")
      ? "image/gif"
      : "image/jpeg";
    userContent.push({
      type: "image_url",
      image_url: {
        url: `data:${imageType};base64,${buffer.toString("base64")}`,
        detail: "high",
      },
    });
  }
  userContent.push({ type: "text", text: "Extract all purchase order fields from this document." });

  let raw = "";
  try {
    const response = await baseClient.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1024,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });
    raw = response.choices[0]?.message?.content ?? "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `AI extraction failed: ${msg}` }, { status: 502 });
  } finally {
    if (uploadedFileId) {
      filesClient.files.delete(uploadedFileId).catch(() => {});
    }
  }

  let extracted: ExtractedPO;
  try {
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

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storeFile } from "@/lib/storage";
import { extractInvoice, buildDuplicateKey } from "@/lib/claude";
import { sendConfirmationEmail } from "@/lib/email";
import { generateReferenceNo, isValidMime } from "@/lib/utils";

// Allow Vercel serverless functions to keep running after response is sent
// (waitUntil keeps background extraction alive on Vercel)
let waitUntilFn: ((promise: Promise<unknown>) => void) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const vf = require("@vercel/functions") as { waitUntil?: (p: Promise<unknown>) => void };
  waitUntilFn = vf.waitUntil ?? null;
} catch {
  // Not on Vercel — background tasks run normally as Node.js process keeps running
  waitUntilFn = null;
}

function scheduleBackground(promise: Promise<void>) {
  if (waitUntilFn) {
    waitUntilFn(promise);
  }
  // On Railway/local Node.js the process stays alive, so fire-and-forget is fine
}

export const maxDuration = 60; // seconds — raise to 300 on Vercel Pro if needed

const MAX_FILES = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const submittedBy = (formData.get("email") as string | null) ?? null;
  const submittedName = (formData.get("name") as string | null) ?? null;
  const files = formData.getAll("files") as File[];

  if (!files || files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Maximum ${MAX_FILES} files per upload` },
      { status: 400 }
    );
  }

  const results: Array<{
    referenceNo: string;
    fileName: string;
    status: string;
    error?: string;
  }> = [];

  for (const file of files) {
    try {
      if (!isValidMime(file.type)) {
        results.push({
          referenceNo: "",
          fileName: file.name,
          status: "error",
          error: `Unsupported file type: ${file.type}`,
        });
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        results.push({
          referenceNo: "",
          fileName: file.name,
          status: "error",
          error: "File exceeds 20 MB limit",
        });
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const stored = await storeFile(buffer, file.name, file.type, "web");
      const referenceNo = generateReferenceNo();

      // Find or create vendor
      let vendorId: string | null = null;

      // Create invoice record
      const invoice = await prisma.invoice.create({
        data: {
          referenceNo,
          channel: "web",
          status: "processing",
          fileUrl: stored.url,
          fileName: stored.fileName,
          mimeType: stored.mimeType,
          fileSize: stored.fileSize,
          submittedBy,
          submittedName,
          vendorId,
        },
      });

      // Log ingestion event
      await prisma.ingestionEvent.create({
        data: {
          invoiceId: invoice.id,
          eventType: "received",
          metadata: JSON.stringify({
            channel: "web",
            fileName: file.name,
            submittedBy,
          }),
        },
      });

      // Run extraction asynchronously — uses waitUntil on Vercel, fire-and-forget on Railway/local
      scheduleBackground(
        processInvoice(invoice.id, buffer, stored.mimeType, submittedBy).catch((err) => {
          console.error(`[Extract] Failed for invoice ${invoice.id}:`, err);
        })
      );

      results.push({ referenceNo, fileName: file.name, status: "received" });
    } catch (err) {
      console.error("[Upload] Error processing file:", err);
      results.push({
        referenceNo: "",
        fileName: file.name,
        status: "error",
        error: "Processing failed. Please try again.",
      });
    }
  }

  // Send confirmation email
  if (submittedBy && results.some((r) => r.status === "received")) {
    const firstSuccess = results.find((r) => r.status === "received");
    if (firstSuccess) {
      sendConfirmationEmail({
        to: submittedBy,
        referenceNo: firstSuccess.referenceNo,
      }).catch((err) => console.error("[Email]", err));
    }
  }

  return NextResponse.json({ results });
}

/** Background: extract invoice data using Claude, then update DB */
async function processInvoice(
  invoiceId: string,
  buffer: Buffer,
  mimeType: string,
  submittedBy: string | null
) {
  await prisma.ingestionEvent.create({
    data: {
      invoiceId,
      eventType: "processing_started",
    },
  });

  try {
    const extraction = await extractInvoice(buffer, mimeType);

    // Upsert vendor
    let vendorId: string | null = null;
    const vendorNameValue = extraction.vendor_name?.value;
    if (vendorNameValue && typeof vendorNameValue === "string" && vendorNameValue.trim()) {
      const existing = await prisma.vendor.findFirst({
        where: {
          name: { equals: vendorNameValue.trim() },
        },
      });

      if (existing) {
        vendorId = existing.id;
      } else {
        const vendorAddressValue = extraction.vendor_address?.value;
        const created = await prisma.vendor.create({
          data: {
            name: vendorNameValue.trim(),
            email: submittedBy?.includes("@") ? submittedBy : null,
            address: vendorAddressValue && typeof vendorAddressValue === "string" ? vendorAddressValue : null,
          },
        });
        vendorId = created.id;
      }
    }

    // Duplicate detection
    const invoiceNumberValue = extraction.invoice_number?.value;
    const duplicateKey = buildDuplicateKey(
      typeof invoiceNumberValue === "string" ? invoiceNumberValue : null,
      typeof vendorNameValue === "string" ? vendorNameValue : null
    );

    let isDuplicate = false;
    let duplicateOf: string | null = null;

    if (duplicateKey) {
      // Look for existing invoice with same vendor + invoice number
      const invoiceNum = typeof invoiceNumberValue === "string" ? invoiceNumberValue : null;
      const vendorName = typeof vendorNameValue === "string" ? vendorNameValue : null;

      if (invoiceNum || vendorName) {
        const existingField = await prisma.extractedField.findFirst({
          where: {
            fieldName: "invoice_number",
            value: invoiceNum ?? undefined,
            invoice: {
              id: { not: invoiceId },
              ...(vendorId ? { vendorId } : {}),
            },
          },
          include: { invoice: true },
        });

        if (existingField) {
          isDuplicate = true;
          duplicateOf = existingField.invoiceId;
        }
      }
    }

    // Store extracted fields
    const SCALAR_FIELDS = [
      "vendor_name",
      "vendor_address",
      "invoice_number",
      "issue_date",
      "due_date",
      "subtotal",
      "tax",
      "total",
      "currency",
      "po_reference",
      "payment_terms",
      "bank_details",
    ] as const;

    const fieldInserts = SCALAR_FIELDS.map((key) => {
      const field = extraction[key];
      return {
        invoiceId,
        fieldName: key,
        value: field?.value != null ? String(field.value) : null,
        confidence: field?.confidence ?? null,
        isUncertain: field?.is_uncertain ?? false,
      };
    });

    await prisma.extractedField.createMany({ data: fieldInserts });

    // Store line items
    if (extraction.line_items.length > 0) {
      await prisma.lineItem.createMany({
        data: extraction.line_items.map((li) => ({
          invoiceId,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unit_price,
          lineTotal: li.line_total,
          confidence: li.confidence,
        })),
      });
    }

    // Determine flags
    const flags: string[] = [];
    if (isDuplicate) flags.push("duplicate");

    // Flag low-confidence fields
    const lowConfFields = SCALAR_FIELDS.filter((key) => {
      const c = extraction[key]?.confidence;
      return c != null && c < 0.85;
    });
    if (lowConfFields.length > 0) flags.push("low_confidence");

    // Update invoice record
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "extracted",
        processedAt: new Date(),
        vendorId,
        isDuplicate,
        duplicateOf,
        flags: JSON.stringify(flags),
      },
    });

    await prisma.ingestionEvent.create({
      data: {
        invoiceId,
        eventType: "extracted",
        metadata: JSON.stringify({
          fieldsExtracted: SCALAR_FIELDS.length,
          lineItems: extraction.line_items.length,
          isDuplicate,
          flags,
        }),
      },
    });

    // Update confirmation email with extracted data
    if (submittedBy?.includes("@")) {
      const total = extraction.total?.value;
      const currency = extraction.currency?.value;
      const vendorName = extraction.vendor_name?.value;

      sendConfirmationEmail({
        to: submittedBy,
        referenceNo: (await prisma.invoice.findUnique({ where: { id: invoiceId } }))!.referenceNo,
        vendorName: typeof vendorName === "string" ? vendorName : undefined,
        total:
          total != null && currency
            ? `${currency} ${Number(total).toFixed(2)}`
            : undefined,
      }).catch(console.error);
    }
  } catch (err) {
    console.error("[Extract] Error:", err);
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "error", flags: JSON.stringify(["extraction_failed"]) },
    });
    await prisma.ingestionEvent.create({
      data: {
        invoiceId,
        eventType: "extraction_failed",
        metadata: JSON.stringify({ error: String(err) }),
      },
    });
  }
}

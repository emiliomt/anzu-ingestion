// Anzu Dynamics — Invoice Upload API
// POST /api/upload — accepts multipart form-data with invoice files (PDF/image/XML).
// Public route (no auth required) for vendor portal uploads.
// When called by an authenticated user, injects their organizationId.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { storeFile } from "@/lib/storage";
import { extractInvoiceWithOcr, buildDuplicateKey } from "@/lib/claude";
import { buildFewShotSection } from "@/lib/few-shot";
import { runSecurityCheck } from "@/lib/security-client";
import { sendConfirmationEmail } from "@/lib/email";
import { generateReferenceNo, isValidMime } from "@/lib/utils";
import { getSettings } from "@/lib/app-settings";
import { checkQuotaOrNull } from "@/lib/quota";

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

export const dynamic = "force-dynamic";
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

  // Resolve organizationId from Clerk session if authenticated.
  // Unauthenticated vendor-portal uploads get null (visible only to admins without org filter).
  const { orgId: organizationId } = await auth();

  // Enforce per-org monthly quota (unauthenticated uploads are always allowed)
  const quota = await checkQuotaOrNull(organizationId);
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `Monthly quota exceeded. Your ${quota.plan} plan allows ${quota.limit} invoices per month. Used: ${quota.used}. Quota resets on ${new Date(quota.resetAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`,
        quota,
      },
      { status: 429 }
    );
  }

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

      // Create invoice record — inject organizationId when user is authenticated
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
          ...(organizationId ? { organizationId } : {}),
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
        processInvoice(invoice.id, referenceNo, buffer, stored.mimeType, submittedBy, organizationId).catch(async (err) => {
          console.error(`[Extract] Failed for invoice ${invoice.id}:`, err);
          // Fallback: if processInvoice's own catch block threw (e.g. DB unavailable before
          // the try/catch was entered), ensure the invoice is not stuck in "processing" forever.
          try {
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: { status: "error", flags: JSON.stringify(["extraction_failed"]) },
            });
          } catch (updateErr) {
            console.error(`[Extract] Failed to mark invoice ${invoice.id} as error:`, updateErr);
          }
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
  referenceNo: string,
  buffer: Buffer,
  mimeType: string,
  submittedBy: string | null,
  organizationId?: string | null
) {
  await prisma.ingestionEvent.create({
    data: {
      invoiceId,
      eventType: "processing_started",
    },
  });

  // Load settings scoped to this organization (with global fallback)
  const settings = await getSettings(organizationId ?? null);

  // Load active custom fields
  const activeCustomFields = await prisma.customField.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  try {
    const { result: extraction, ocrText } = await extractInvoiceWithOcr(buffer, mimeType, {
      default_country:    settings.default_country,
      default_currency:   settings.default_currency,
      document_language:  settings.document_language,
      amount_format:      settings.amount_format,
      timeout_ms:         settings.extraction_timeout_seconds * 1000,
      buildFewShot:       buildFewShotSection,
      fineTunedModelId:   settings.finetune_model_id,
      enabled_fields:     settings.extraction_fields,
      customFields:       activeCustomFields,
    });

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

    // Duplicate detection (only when enabled in settings)
    const invoiceNumberValue = extraction.invoice_number?.value;
    const duplicateKey = buildDuplicateKey(
      typeof invoiceNumberValue === "string" ? invoiceNumberValue : null,
      typeof vendorNameValue === "string" ? vendorNameValue : null
    );

    let isDuplicate = false;
    let duplicateOf: string | null = null;

    if (settings.flag_duplicates && duplicateKey) {
      // Look for existing invoice with same vendor + invoice number
      const invoiceNum = typeof invoiceNumberValue === "string" ? invoiceNumberValue : null;
      const vendorName = typeof vendorNameValue === "string" ? vendorNameValue : null;

      if (invoiceNum) {
        const existingField = await prisma.extractedField.findFirst({
          where: {
            fieldName: "invoice_number",
            value: invoiceNum,
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

    // Store extracted fields — core fields are always written; extended fields
    // (vendor_tax_id, buyer_*, concept, project_*, notes) are written when present.
    const CORE_FIELDS = [
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

    const EXTENDED_FIELDS = [
      "vendor_tax_id",
      "buyer_name",
      "buyer_tax_id",
      "buyer_address",
      "concept",
      "project_name",
      "project_address",
      "project_city",
      "description_summary",
      "notes",
    ] as const;

    // Combine for low-confidence flagging
    const SCALAR_FIELDS = [...CORE_FIELDS, ...EXTENDED_FIELDS] as const;

    // Core fields — always written (value may be null if not found)
    const coreInserts = CORE_FIELDS.map((key) => {
      const field = extraction[key];
      return {
        invoiceId,
        fieldName: key,
        value: field?.value != null ? String(field.value) : null,
        confidence: field?.confidence ?? null,
        isUncertain: field?.is_uncertain ?? false,
      };
    });

    // Extended fields — only written when the field is present in the extraction
    const extendedInserts = EXTENDED_FIELDS
      .filter((key) => {
        const f = extraction[key as keyof typeof extraction];
        return f !== undefined && (f as { value?: unknown }).value !== null;
      })
      .map((key) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const field = extraction[key as keyof typeof extraction] as any;
        return {
          invoiceId,
          fieldName: key,
          value: field?.value != null ? String(field.value) : null,
          confidence: field?.confidence ?? null,
          isUncertain: field?.is_uncertain ?? false,
        };
      });

    // Custom fields — written when the extraction returned a value
    const customInserts = Object.entries(extraction.customFields ?? {})
      .filter(([, field]) => field.value !== null)
      .map(([key, field]) => ({
        invoiceId,
        fieldName: key,
        value: field.value != null ? String(field.value) : null,
        confidence: field.confidence ?? null,
        isUncertain: field.is_uncertain ?? false,
      }));

    await prisma.extractedField.createMany({
      data: [...coreInserts, ...extendedInserts, ...customInserts],
    });

    // Store line items
    if (extraction.line_items.length > 0) {
      await prisma.lineItem.createMany({
        data: extraction.line_items.map((li) => ({
          invoiceId,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unit_price,
          lineTotal: li.line_total,
          category: li.category ?? null,
          confidence: li.confidence,
        })),
      });
    }

    // Determine flags
    const flags: string[] = [];
    if (isDuplicate) flags.push("duplicate");

    // Flag low-confidence fields using the configured threshold
    const confThreshold = settings.low_confidence_threshold;
    const lowConfFields = CORE_FIELDS.filter((key) => {
      const c = extraction[key]?.confidence;
      return c != null && c < confThreshold;
    });
    if (lowConfFields.length > 0) flags.push("low_confidence");

    // Auto-approve: if all core fields meet the threshold, set status to reviewed
    const approveThreshold = settings.auto_approve_threshold;
    const allCoreHighConf = CORE_FIELDS.every((key) => {
      const c = extraction[key]?.confidence;
      return c == null || c >= (approveThreshold ?? Infinity);
    });
    const finalStatus =
      approveThreshold !== null && allCoreHighConf ? "reviewed" : "extracted";

    // Update invoice record (include ocrText for training data)
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: finalStatus,
        processedAt: new Date(),
        vendorId,
        isDuplicate,
        duplicateOf,
        flags: JSON.stringify(flags),
        ...(ocrText ? { ocrText: ocrText.slice(0, 8000) } : {}),
      },
    });

    await prisma.ingestionEvent.create({
      data: {
        invoiceId,
        eventType: finalStatus === "reviewed" ? "reviewed" : "extracted",
        metadata: JSON.stringify({
          fieldsExtracted: SCALAR_FIELDS.length,
          lineItems: extraction.line_items.length,
          isDuplicate,
          flags,
          autoApproved: finalStatus === "reviewed",
        }),
      },
    });

    // Run security check (anzu-security middleware) — non-blocking on failure
    // If SECURITY_SERVICE_URL is not set this is a no-op.
    const securityResult = await runSecurityCheck({
      invoice_id:   invoiceId,
      reference_no: referenceNo,
      channel:      "web",
      vendor_name:    extraction.vendor_name   ? { value: extraction.vendor_name.value,   confidence: extraction.vendor_name.confidence,   is_uncertain: extraction.vendor_name.is_uncertain }   : undefined,
      vendor_tax_id:  extraction.vendor_tax_id ? { value: extraction.vendor_tax_id.value, confidence: extraction.vendor_tax_id.confidence, is_uncertain: extraction.vendor_tax_id.is_uncertain } : undefined,
      vendor_address: extraction.vendor_address ? { value: extraction.vendor_address.value, confidence: extraction.vendor_address.confidence, is_uncertain: extraction.vendor_address.is_uncertain } : undefined,
      buyer_name:    extraction.buyer_name    ? { value: extraction.buyer_name.value,    confidence: extraction.buyer_name.confidence,    is_uncertain: extraction.buyer_name.is_uncertain }    : undefined,
      buyer_tax_id:  extraction.buyer_tax_id  ? { value: extraction.buyer_tax_id.value,  confidence: extraction.buyer_tax_id.confidence,  is_uncertain: extraction.buyer_tax_id.is_uncertain }  : undefined,
      buyer_address: extraction.buyer_address ? { value: extraction.buyer_address.value, confidence: extraction.buyer_address.confidence, is_uncertain: extraction.buyer_address.is_uncertain } : undefined,
      invoice_number: extraction.invoice_number ? { value: extraction.invoice_number.value, confidence: extraction.invoice_number.confidence } : undefined,
      total:    extraction.total    ? { value: extraction.total.value,    confidence: extraction.total.confidence }    : undefined,
      currency: extraction.currency ? { value: extraction.currency.value, confidence: extraction.currency.confidence } : undefined,
      line_items: extraction.line_items.map((li) => ({
        description: li.description ?? null,
        quantity:    li.quantity    ?? null,
        unit_price:  li.unit_price  ?? null,
        line_total:  li.line_total  ?? null,
        category:    li.category    ?? null,
        confidence:  li.confidence,
      })),
    });

    if (securityResult && !securityResult.passed) {
      flags.push("security_failed");
      await prisma.invoice.update({
        where: { id: invoiceId },
        data:  { flags: JSON.stringify(flags) },
      });
      await prisma.ingestionEvent.create({
        data: {
          invoiceId,
          eventType: "security_failed",
          metadata: JSON.stringify({
            risk_level:      securityResult.risk_level,
            failure_reasons: securityResult.failure_reasons,
          }),
        },
      });
      console.warn(`[Security] Invoice ${invoiceId} failed security check: ${securityResult.failure_reasons.join("; ")}`);
    }

    // Update confirmation email with extracted data
    if (submittedBy?.includes("@")) {
      const total = extraction.total?.value;
      const currency = extraction.currency?.value;
      const vendorName = extraction.vendor_name?.value;

      sendConfirmationEmail({
        to: submittedBy,
        referenceNo,
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

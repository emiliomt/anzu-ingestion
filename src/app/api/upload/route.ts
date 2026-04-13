// Anzu Dynamics — Invoice Upload API
// POST /api/upload — accepts multipart form-data with invoice files (PDF/image/XML).
// Public route (no auth required) for vendor portal uploads.
// When called by an authenticated user, injects their organizationId.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { storeFile } from "@/lib/storage";
import { extractInvoiceWithOcr, buildDuplicateKey } from "@/lib/claude";
import { buildFewShotSection } from "@/lib/few-shot";
import { runSecurityCheck } from "@/lib/security-client";
import { sendConfirmationEmail } from "@/lib/email";
import { generateReferenceNo, isValidMime, isZipMime } from "@/lib/utils";
import { getSettings } from "@/lib/app-settings";
import { checkQuotaOrNull } from "@/lib/quota";
import { enqueueInvoice } from "@/lib/jobs/queues";

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

const MAX_FILES = 2500;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_ZIP_ENTRIES = 2000;
const MAX_ANONYMOUS_INLINE_FILES = 20;

type UploadInputFile = {
  name: string;
  type: string;
  size: number;
  buffer: Buffer;
};

function mapUploadErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? "");
  const lower = message.toLowerCase();
  const code = typeof (err as { code?: unknown })?.code === "string"
    ? (err as { code: string }).code
    : null;

  if (
    lower.includes("can't reach database server") ||
    lower.includes("database server is running at")
  ) {
    return "Upload could not be saved because the database is unreachable. Please retry shortly. If this keeps happening, verify DATABASE_URL connectivity.";
  }

  if (code === "P2021" || lower.includes("does not exist in the current database")) {
    return "Upload could not be saved because database tables are not ready. Run Prisma migrations/db push and retry.";
  }

  if (
    lower.includes("api.files.write") ||
    lower.includes("openai key not configured for files api") ||
    lower.includes("insufficient_scope")
  ) {
    return "PDF processing key is missing OpenAI Files API access (api.files.write). Configure OPENAI_FULL_ACCESS_API_KEY with full capabilities.";
  }

  return "Processing failed. Please try again.";
}

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
  // org ID optionally embedded in portal URL and forwarded as a hidden form field
  const formOrgId = (formData.get("organizationId") as string | null) ?? null;

  // Resolve organizationId: JWT → Clerk API fallback → form field (vendor portal with ?org=)
  const session = await auth();
  let organizationId: string | null = session.orgId ?? null;
  if (session.userId && !organizationId) {
    try {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const client = await clerkClient();
      const { data: memberships } = await client.users.getOrganizationMembershipList({
        userId: session.userId,
        limit: 1,
      });
      if (memberships.length > 0) organizationId = memberships[0].organization.id;
    } catch {
      // ignore — fall through to form field
    }
  }
  if (!organizationId && formOrgId) organizationId = formOrgId;

  // Quota checks are informational only; uploads are never blocked.
  // Wrapped in try/catch so a missing subscriptions table (e.g. first deploy before
  // prisma db push finishes) still allows uploads.
  try {
    const quota = await checkQuotaOrNull(organizationId);
    if (!quota.allowed) {
      console.warn(
        `[Upload] quota exceeded for org ${organizationId ?? "none"} ` +
        `(plan=${quota.plan}, used=${quota.used}, limit=${quota.limit}) — allowing upload`
      );
    }
  } catch (quotaErr) {
    // Non-fatal — log and continue
    console.warn("[Upload] quota check failed (schema may be out of sync):", quotaErr);
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

  let expandedFiles: UploadInputFile[];
  try {
    expandedFiles = await expandIncomingFiles(files);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (expandedFiles.length === 0) {
    return NextResponse.json({ error: "No supported files found in upload." }, { status: 400 });
  }

  if (expandedFiles.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Expanded upload contains ${expandedFiles.length} files. Maximum is ${MAX_FILES}.` },
      { status: 400 }
    );
  }

  const results: Array<{
    referenceNo: string;
    fileName: string;
    status: string;
    error?: string;
  }> = [];

  for (const file of expandedFiles) {
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

      const stored = await storeFile(file.buffer, file.name, file.type, "web");
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

      if (organizationId) {
        try {
          await enqueueInvoice({
            invoiceId: invoice.id,
            organizationId,
            fileUrl: stored.url,
            mimeType: stored.mimeType,
          });
        } catch (queueErr) {
          console.error(`[Upload] Queue enqueue failed for ${invoice.id}, falling back inline:`, queueErr);
          scheduleBackground(
            processInvoice(invoice.id, referenceNo, file.buffer, stored.mimeType, submittedBy, organizationId).catch(async (err) => {
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
        }
      } else if (expandedFiles.length <= MAX_ANONYMOUS_INLINE_FILES) {
        // Anonymous uploads cannot be queued because the queue payload requires organizationId.
        // Keep inline behavior for smaller batches.
        scheduleBackground(
          processInvoice(invoice.id, referenceNo, file.buffer, stored.mimeType, submittedBy, organizationId).catch(async (err) => {
            console.error(`[Extract] Failed for invoice ${invoice.id}:`, err);
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
      } else {
        results.push({
          referenceNo: "",
          fileName: file.name,
          status: "error",
          error:
            "Large batch extraction requires organization context. Sign in to an organization workspace or split into smaller batches.",
        });
        continue;
      }

      results.push({ referenceNo, fileName: file.name, status: "received" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const actionableError = mapUploadErrorMessage(err);
      console.error(`[Upload] Error processing file "${file.name}":`, msg, err);
      results.push({
        referenceNo: "",
        fileName: file.name,
        status: "error",
        error: actionableError,
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

async function expandIncomingFiles(files: File[]): Promise<UploadInputFile[]> {
  const expanded: UploadInputFile[] = [];

  for (const file of files) {
    if (isZipMime(file.type) || file.name.toLowerCase().endsWith(".zip")) {
      const zipBuffer = Buffer.from(await file.arrayBuffer());
      const zip = await JSZip.loadAsync(zipBuffer);
      const zipEntries = Object.values(zip.files).filter((entry) => !entry.dir);

      if (zipEntries.length === 0) {
        throw new Error(`ZIP "${file.name}" is empty.`);
      }
      if (zipEntries.length > MAX_ZIP_ENTRIES) {
        throw new Error(
          `ZIP "${file.name}" has ${zipEntries.length} files. Maximum allowed per ZIP is ${MAX_ZIP_ENTRIES}.`
        );
      }

      for (const entry of zipEntries) {
        const entryName = entry.name.split("/").pop() || entry.name;
        const entryLower = entryName.toLowerCase();
        const inferredMime = inferMimeFromName(entryLower);
        if (!inferredMime || !isValidMime(inferredMime)) {
          continue;
        }
        const entryBuffer = await entry.async("nodebuffer");
        expanded.push({
          name: entryName,
          type: inferredMime,
          size: entryBuffer.length,
          buffer: entryBuffer,
        });
      }
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    expanded.push({
      name: file.name,
      type: file.type || inferMimeFromName(file.name.toLowerCase()) || "application/octet-stream",
      size: file.size,
      buffer,
    });
  }

  return expanded;
}

function inferMimeFromName(name: string): string | null {
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".jpeg") || name.endsWith(".jpg")) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".heic") || name.endsWith(".heif")) return "image/heic";
  if (name.endsWith(".tiff") || name.endsWith(".tif")) return "image/tiff";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".xml")) return "application/xml";
  return null;
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

  try {
    // Load settings scoped to this organization (with global fallback)
    const settings = await getSettings(organizationId ?? null);

    // Load active custom fields
    const activeCustomFields = await prisma.customField.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });

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

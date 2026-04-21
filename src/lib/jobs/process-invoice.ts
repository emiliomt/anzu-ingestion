// Anzu Dynamics — Shared Invoice Processing Pipeline
// Used by both the inline upload handler (via scheduleBackground) and the
// BullMQ invoice worker so the two code-paths stay in sync.
//
// Call signature mirrors the original inline function in upload/route.ts.

import { prisma } from "../prisma";
import { extractInvoiceWithOcr, buildDuplicateKey } from "../claude";
import { getSettings } from "../app-settings";
import { buildFewShotSection } from "../few-shot";
import { runSecurityCheck } from "../security-client";
import { sendConfirmationEmail } from "../email";

// ── Field lists (kept in sync with upload/route.ts) ──────────────────────────

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

const SCALAR_FIELDS = [...CORE_FIELDS, ...EXTENDED_FIELDS] as const;

export interface ProcessInvoicePipelineOptions {
  /**
   * Re-throw after persisting extraction_failed so BullMQ marks the attempt as failed.
   * Keep false for fire-and-forget callers that should not crash their parent flow.
   */
  rethrowOnError?: boolean;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Runs the full OCR + AI extraction pipeline for a single invoice.
 *
 * @param invoiceId       - DB primary key of the Invoice record
 * @param referenceNo     - Human-readable reference (ANZ-XXXXX)
 * @param buffer          - Raw file bytes (PDF / image / XML)
 * @param mimeType        - MIME type of the file
 * @param submittedBy     - Submitter email (for confirmation email)
 * @param organizationId  - Clerk org ID for settings + isolation (null = legacy)
 */
export async function processInvoicePipeline(
  invoiceId: string,
  referenceNo: string,
  buffer: Buffer,
  mimeType: string,
  submittedBy: string | null,
  organizationId?: string | null,
  opts: ProcessInvoicePipelineOptions = {}
): Promise<void> {
  await prisma.ingestionEvent.create({
    data: { invoiceId, eventType: "processing_started" },
  });

  const settings = await getSettings(organizationId ?? null);

  const activeCustomFields = await prisma.customField.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  try {
    const { result: extraction, ocrText } = await extractInvoiceWithOcr(buffer, mimeType, {
      default_country:   settings.default_country,
      default_currency:  settings.default_currency,
      document_language: settings.document_language,
      amount_format:     settings.amount_format,
      timeout_ms:        settings.extraction_timeout_seconds * 1000,
      buildFewShot:      buildFewShotSection,
      fineTunedModelId:  settings.finetune_model_id,
      enabled_fields:    settings.extraction_fields,
      customFields:      activeCustomFields,
    });

    // ── Vendor upsert ─────────────────────────────────────────────────────────
    let vendorId: string | null = null;
    const vendorNameValue = extraction.vendor_name?.value;
    if (vendorNameValue && typeof vendorNameValue === "string" && vendorNameValue.trim()) {
      const existing = await prisma.vendor.findFirst({
        where: { name: { equals: vendorNameValue.trim() } },
      });
      if (existing) {
        vendorId = existing.id;
      } else {
        const vendorAddressValue = extraction.vendor_address?.value;
        const created = await prisma.vendor.create({
          data: {
            name: vendorNameValue.trim(),
            email: submittedBy?.includes("@") ? submittedBy : null,
            address:
              vendorAddressValue && typeof vendorAddressValue === "string"
                ? vendorAddressValue
                : null,
          },
        });
        vendorId = created.id;
      }
    }

    // ── Duplicate detection ───────────────────────────────────────────────────
    const invoiceNumberValue = extraction.invoice_number?.value;
    const duplicateKey = buildDuplicateKey(
      typeof invoiceNumberValue === "string" ? invoiceNumberValue : null,
      typeof vendorNameValue === "string" ? vendorNameValue : null
    );

    let isDuplicate = false;
    let duplicateOf: string | null = null;

    if (settings.flag_duplicates && duplicateKey) {
      const invoiceNum = typeof invoiceNumberValue === "string" ? invoiceNumberValue : null;
      if (invoiceNum) {
        const existingField = await prisma.extractedField.findFirst({
          where: {
            fieldName: "invoice_number",
            value: invoiceNum,
            invoice: { id: { not: invoiceId }, ...(vendorId ? { vendorId } : {}) },
          },
          include: { invoice: true },
        });
        if (existingField) {
          isDuplicate = true;
          duplicateOf = existingField.invoiceId;
        }
      }
    }

    // ── Store extracted fields ────────────────────────────────────────────────
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

    const extendedInserts = EXTENDED_FIELDS
      .filter((key) => {
        const f = extraction[key as keyof typeof extraction];
        return f !== undefined && (f as { value?: unknown }).value !== null;
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((key) => {
        const field = extraction[key as keyof typeof extraction] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        return {
          invoiceId,
          fieldName: key,
          value: field?.value != null ? String(field.value) : null,
          confidence: field?.confidence ?? null,
          isUncertain: field?.is_uncertain ?? false,
        };
      });

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

    // ── Line items ────────────────────────────────────────────────────────────
    if (extraction.line_items.length > 0) {
      await prisma.lineItem.createMany({
        data: extraction.line_items.map((li) => ({
          invoiceId,
          description: li.description,
          quantity:    li.quantity,
          unitPrice:   li.unit_price,
          lineTotal:   li.line_total,
          category:    li.category ?? null,
          confidence:  li.confidence,
        })),
      });
    }

    // ── Flags + status ────────────────────────────────────────────────────────
    const flags: string[] = [];
    if (isDuplicate) flags.push("duplicate");

    const confThreshold = settings.low_confidence_threshold;
    const lowConfFields = CORE_FIELDS.filter((key) => {
      const c = extraction[key]?.confidence;
      return c != null && c < confThreshold;
    });
    if (lowConfFields.length > 0) flags.push("low_confidence");

    const approveThreshold = settings.auto_approve_threshold;
    const allCoreHighConf = CORE_FIELDS.every((key) => {
      const c = extraction[key]?.confidence;
      return c == null || c >= (approveThreshold ?? Infinity);
    });
    const finalStatus =
      approveThreshold !== null && allCoreHighConf ? "reviewed" : "extracted";

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
          lineItems:       extraction.line_items.length,
          isDuplicate,
          flags,
          autoApproved:    finalStatus === "reviewed",
        }),
      },
    });

    // ── Security check (non-blocking) ─────────────────────────────────────────
    const securityResult = await runSecurityCheck({
      invoice_id:   invoiceId,
      reference_no: referenceNo,
      channel:      "worker",
      vendor_name:    extraction.vendor_name    ? { value: extraction.vendor_name.value,    confidence: extraction.vendor_name.confidence,    is_uncertain: extraction.vendor_name.is_uncertain }    : undefined,
      vendor_tax_id:  extraction.vendor_tax_id  ? { value: extraction.vendor_tax_id.value,  confidence: extraction.vendor_tax_id.confidence,  is_uncertain: extraction.vendor_tax_id.is_uncertain }  : undefined,
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
    }

    // ── Confirmation email ────────────────────────────────────────────────────
    if (submittedBy?.includes("@")) {
      const total      = extraction.total?.value;
      const currency   = extraction.currency?.value;
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
    console.error(`[process-invoice] Error for ${invoiceId}:`, err);
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
    if (opts.rethrowOnError) {
      throw err;
    }
  }
}

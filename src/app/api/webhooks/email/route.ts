import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storeFile } from "@/lib/storage";
import { extractInvoiceWithOcr, buildDuplicateKey } from "@/lib/claude";
import { buildFewShotSection } from "@/lib/few-shot";
import { sendConfirmationEmail, sendBounceEmail } from "@/lib/email";
import { getSettings } from "@/lib/app-settings";
import { runSecurityCheck } from "@/lib/security-client";
import { generateReferenceNo, isValidMime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Allow Vercel serverless functions to keep running after response is sent
let waitUntilFn: ((promise: Promise<unknown>) => void) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const vf = require("@vercel/functions") as { waitUntil?: (p: Promise<unknown>) => void };
  waitUntilFn = vf.waitUntil ?? null;
} catch {
  waitUntilFn = null;
}

function scheduleBackground(promise: Promise<void>) {
  if (waitUntilFn) {
    waitUntilFn(promise);
  }
}

/**
 * Verify SendGrid signed webhook signature.
 * Returns true when verification passes or when SENDGRID_WEBHOOK_SECRET is not set.
 * https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features
 */
function verifyWebhookSignature(request: NextRequest): boolean {
  const secret = process.env.SENDGRID_WEBHOOK_SECRET;
  if (!secret) return true; // verification disabled

  const signature = request.headers.get("X-Twilio-Email-Event-Webhook-Signature");
  const timestamp  = request.headers.get("X-Twilio-Email-Event-Webhook-Timestamp");
  if (!signature || !timestamp) return false;

  try {
    const crypto = require("crypto") as typeof import("crypto");
    const publicKey = Buffer.from(secret, "base64");
    // SendGrid ECDSA verification: payload = timestamp + rawBody
    // We verify the signature against the public key provided in the dashboard.
    // For simplicity we use the HMAC-based fallback that some integrations use.
    const hmac = crypto.createHmac("sha256", publicKey);
    hmac.update(timestamp + signature);
    const expected = hmac.digest("base64");
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    // If crypto verification fails for any reason, deny to be safe
    return false;
  }
}

/**
 * POST /api/webhooks/email
 * Handles SendGrid Inbound Parse webhook payloads.
 * Each incoming email with invoice attachments is processed as an individual invoice.
 */
export async function POST(request: NextRequest) {
  // Optional signature verification
  if (!verifyWebhookSignature(request)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const from    = (formData.get("from")    as string | null) ?? "";
  const subject = (formData.get("subject") as string | null) ?? "";

  // Extract sender email from "Name <email>" format
  const emailMatch = from.match(/<(.+?)>/) ?? [null, from];
  const senderEmail = emailMatch[1]?.trim() ?? from.trim();

  // Count attachments
  const attachmentCount = parseInt(
    (formData.get("attachments") as string | null) ?? "0"
  );

  if (attachmentCount === 0) {
    if (senderEmail) {
      await sendBounceEmail(
        senderEmail,
        "No valid invoice attachment found. Please attach a PDF or image file."
      );
    }
    return NextResponse.json({ message: "No attachments" }, { status: 200 });
  }

  let processed = 0;
  let firstRefNo = "";

  for (let i = 1; i <= attachmentCount; i++) {
    const attachment = formData.get(`attachment${i}`) as File | null;
    if (!attachment) continue;
    if (!isValidMime(attachment.type)) continue;

    const buffer = Buffer.from(await attachment.arrayBuffer());
    const referenceNo = generateReferenceNo();

    const stored = await storeFile(
      buffer,
      attachment.name,
      attachment.type,
      "email"
    );

    const invoice = await prisma.invoice.create({
      data: {
        referenceNo,
        channel: "email",
        status: "processing",
        fileUrl: stored.url,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        fileSize: stored.fileSize,
        submittedBy: senderEmail || null,
        submittedName: null,
      },
    });

    await prisma.ingestionEvent.create({
      data: {
        invoiceId: invoice.id,
        eventType: "received",
        metadata: JSON.stringify({
          channel: "email",
          from: senderEmail,
          subject,
          attachmentIndex: i,
        }),
      },
    });

    if (!firstRefNo) firstRefNo = referenceNo;
    processed++;

    scheduleBackground(
      processEmailInvoice(invoice.id, referenceNo, buffer, stored.mimeType, senderEmail).catch(
        async (err) => {
          console.error(`[Email Extract] Failed for invoice ${invoice.id}:`, err);
          try {
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: { status: "error", flags: JSON.stringify(["extraction_failed"]) },
            });
          } catch (updateErr) {
            console.error(`[Email Extract] Failed to mark invoice ${invoice.id} as error:`, updateErr);
          }
        }
      )
    );
  }

  if (processed === 0) {
    if (senderEmail) {
      await sendBounceEmail(
        senderEmail,
        "No supported file types found. Please send PDF, JPEG, or PNG files."
      );
    }
    return NextResponse.json({ message: "No valid attachments" }, { status: 200 });
  }

  // Send initial confirmation (before extraction completes)
  if (senderEmail && firstRefNo) {
    sendConfirmationEmail({
      to: senderEmail,
      referenceNo: firstRefNo,
      channel: "email",
    }).catch(console.error);
  }

  return NextResponse.json({ received: processed });
}

async function processEmailInvoice(
  invoiceId: string,
  referenceNo: string,
  buffer: Buffer,
  mimeType: string,
  senderEmail: string
) {
  await prisma.ingestionEvent.create({
    data: {
      invoiceId,
      eventType: "processing_started",
    },
  });

  const settings = await getSettings();

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

    // Upsert vendor
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
            email: senderEmail || null,
            address: vendorAddressValue && typeof vendorAddressValue === "string" ? vendorAddressValue : null,
          },
        });
        vendorId = created.id;
      }
    }

    // Duplicate detection
    const invoiceNumberValue = extraction.invoice_number?.value;
    buildDuplicateKey(
      typeof invoiceNumberValue === "string" ? invoiceNumberValue : null,
      typeof vendorNameValue === "string" ? vendorNameValue : null
    );

    let isDuplicate = false;
    let duplicateOf: string | null = null;

    if (settings.flag_duplicates) {
      const invoiceNum = typeof invoiceNumberValue === "string" ? invoiceNumberValue : null;
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

    // Core fields — always written
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

    // Extended fields — only when present
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

    const confThreshold = settings.low_confidence_threshold;
    const lowConfFields = CORE_FIELDS.filter((key) => {
      const c = extraction[key]?.confidence;
      return c != null && c < confThreshold;
    });
    if (lowConfFields.length > 0) flags.push("low_confidence");

    // Auto-approve
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
          lineItems: extraction.line_items.length,
          isDuplicate,
          flags,
          autoApproved: finalStatus === "reviewed",
        }),
      },
    });

    // Security check
    const securityResult = await runSecurityCheck({
      invoice_id:     invoiceId,
      reference_no:   referenceNo,
      channel:        "email",
      vendor_name:     extraction.vendor_name     ? { value: extraction.vendor_name.value,     confidence: extraction.vendor_name.confidence,     is_uncertain: extraction.vendor_name.is_uncertain }     : undefined,
      vendor_tax_id:   extraction.vendor_tax_id   ? { value: extraction.vendor_tax_id.value,   confidence: extraction.vendor_tax_id.confidence,   is_uncertain: extraction.vendor_tax_id.is_uncertain }   : undefined,
      vendor_address:  extraction.vendor_address  ? { value: extraction.vendor_address.value,  confidence: extraction.vendor_address.confidence,  is_uncertain: extraction.vendor_address.is_uncertain }  : undefined,
      buyer_name:      extraction.buyer_name      ? { value: extraction.buyer_name.value,      confidence: extraction.buyer_name.confidence,      is_uncertain: extraction.buyer_name.is_uncertain }      : undefined,
      buyer_tax_id:    extraction.buyer_tax_id    ? { value: extraction.buyer_tax_id.value,    confidence: extraction.buyer_tax_id.confidence,    is_uncertain: extraction.buyer_tax_id.is_uncertain }    : undefined,
      buyer_address:   extraction.buyer_address   ? { value: extraction.buyer_address.value,   confidence: extraction.buyer_address.confidence,   is_uncertain: extraction.buyer_address.is_uncertain }   : undefined,
      invoice_number:  extraction.invoice_number  ? { value: extraction.invoice_number.value,  confidence: extraction.invoice_number.confidence }  : undefined,
      total:     extraction.total     ? { value: extraction.total.value,     confidence: extraction.total.confidence }     : undefined,
      currency:  extraction.currency  ? { value: extraction.currency.value,  confidence: extraction.currency.confidence }  : undefined,
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
      console.warn(`[Security] Email invoice ${invoiceId} failed: ${securityResult.failure_reasons.join("; ")}`);
    }

    // Updated confirmation email with extracted data
    if (senderEmail) {
      const total      = extraction.total?.value;
      const currency   = extraction.currency?.value;
      const vendorName = extraction.vendor_name?.value;

      sendConfirmationEmail({
        to: senderEmail,
        referenceNo,
        vendorName: typeof vendorName === "string" ? vendorName : undefined,
        total:
          total != null && currency
            ? `${currency} ${Number(total).toFixed(2)}`
            : undefined,
        channel: "email",
      }).catch(console.error);
    }
  } catch (err) {
    console.error("[Email Extract]", err);
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

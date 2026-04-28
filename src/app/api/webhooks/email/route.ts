import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storeFile } from "@/lib/storage";
import { extractInvoice } from "@/lib/claude";
import { sendConfirmationEmail, sendBounceEmail } from "@/lib/email";
import { getSettings } from "@/lib/app-settings";
import { runSecurityCheck } from "@/lib/security-client";

export const dynamic = "force-dynamic";
import { classifyInvoiceFile, generateReferenceNo } from "@/lib/utils";

/**
 * POST /api/webhooks/email
 * Handles SendGrid Inbound Parse webhook payloads.
 * Each incoming email with invoice attachments is processed as individual invoices.
 */
export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const from = (formData.get("from") as string | null) ?? "";
  const subject = (formData.get("subject") as string | null) ?? "";

  // Extract sender email from "Name <email>" format
  const emailMatch = from.match(/<(.+?)>/) ?? [null, from];
  const senderEmail = emailMatch[1]?.trim() ?? from.trim();

  // Count attachments
  const attachmentCount = parseInt(
    (formData.get("attachments") as string | null) ?? "0"
  );

  if (attachmentCount === 0) {
    // Send bounce
    if (senderEmail) {
      await sendBounceEmail(
        senderEmail,
        "No valid invoice attachment found. Please attach a PDF, XML, or image file."
      );
    }
    return NextResponse.json({ message: "No attachments" }, { status: 200 });
  }

  let processed = 0;
  let firstRefNo = "";

  for (let i = 1; i <= attachmentCount; i++) {
    const attachment = formData.get(`attachment${i}`) as File | null;
    if (!attachment) continue;

    const classified = classifyInvoiceFile(attachment.type, attachment.name);
    if (
      classified.kind === "unsupported" ||
      classified.kind === "zip" ||
      !classified.mimeType
    ) {
      continue;
    }

    const buffer = Buffer.from(await attachment.arrayBuffer());
    const referenceNo = generateReferenceNo();

    const stored = await storeFile(
      buffer,
      attachment.name,
      classified.mimeType,
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

    // Extract async — fallback ensures invoice never stays stuck in "processing"
    // if processEmailInvoice throws before its own try/catch (e.g. getSettings fails).
    processEmailInvoice(invoice.id, buffer, stored.mimeType, senderEmail).catch(
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
    );
  }

  if (processed === 0) {
    if (senderEmail) {
      await sendBounceEmail(
        senderEmail,
        "No supported file types found. Please send PDF, XML, JPEG, or PNG files."
      );
    }
    return NextResponse.json({ message: "No valid attachments" }, { status: 200 });
  }

  // Send confirmation
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
  buffer: Buffer,
  mimeType: string,
  submittedBy: string
) {
  const settings = await getSettings();

  try {
    const extraction = await extractInvoice(buffer, mimeType, {
      default_country:   settings.default_country,
      default_currency:  settings.default_currency,
      document_language: settings.document_language,
      amount_format:     settings.amount_format,
      timeout_ms:        settings.extraction_timeout_seconds * 1000,
    });
    const vendorNameValue = extraction.vendor_name?.value;

    let vendorId: string | null = null;
    if (vendorNameValue && typeof vendorNameValue === "string" && vendorNameValue.trim()) {
      const existing = await prisma.vendor.findFirst({
        where: { name: { equals: vendorNameValue.trim() } },
      });
      if (existing) {
        vendorId = existing.id;
      } else {
        const created = await prisma.vendor.create({
          data: { name: vendorNameValue.trim(), email: submittedBy || null },
        });
        vendorId = created.id;
      }
    }

    const FIELDS = [
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

    await prisma.extractedField.createMany({
      data: FIELDS.map((key) => ({
        invoiceId,
        fieldName: key,
        value: extraction[key]?.value != null ? String(extraction[key].value) : null,
        confidence: extraction[key]?.confidence ?? null,
        isUncertain: extraction[key]?.is_uncertain ?? false,
      })),
    });

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

    const flags: string[] = [];
    const confThreshold = settings.low_confidence_threshold;
    const lowConf = FIELDS.some((k) => {
      const c = extraction[k]?.confidence;
      return c != null && c < confThreshold;
    });
    if (lowConf) flags.push("low_confidence");

    const approveThreshold = settings.auto_approve_threshold;
    const allHighConf = FIELDS.every((k) => {
      const c = extraction[k]?.confidence;
      return c == null || c >= (approveThreshold ?? Infinity);
    });
    const finalStatus =
      approveThreshold !== null && allHighConf ? "reviewed" : "extracted";

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: finalStatus,
        processedAt: new Date(),
        vendorId,
        flags: JSON.stringify(flags),
      },
    });

    // Run security check (anzu-security middleware) — no-op if SECURITY_SERVICE_URL unset
    const invoiceRecord = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { referenceNo: true },
    });
    const securityResult = await runSecurityCheck({
      invoice_id:   invoiceId,
      reference_no: invoiceRecord?.referenceNo ?? invoiceId,
      channel:      "email",
      vendor_name:    extraction.vendor_name    ? { value: extraction.vendor_name.value,    confidence: extraction.vendor_name.confidence }    : undefined,
      vendor_tax_id:  undefined,  // not extracted in email path
      buyer_name:    undefined,
      buyer_tax_id:  undefined,
      buyer_address: undefined,
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
      console.warn(`[Security] Email invoice ${invoiceId} failed: ${securityResult.failure_reasons.join("; ")}`);
    }
  } catch (err) {
    console.error("[Email Extract]", err);
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "error", flags: JSON.stringify(["extraction_failed"]) },
    });
  }
}

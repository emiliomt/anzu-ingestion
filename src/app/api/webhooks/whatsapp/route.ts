import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { storeFile } from "@/lib/storage";
import { extractInvoice } from "@/lib/claude";
import { generateReferenceNo } from "@/lib/utils";
import { getSettings } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/whatsapp
 * Handles Twilio incoming message webhooks.
 * Accepts image and document (PDF) attachments from WhatsApp senders.
 */
export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    // Try JSON body
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const from = (formData.get("From") as string | null) ?? "";
  const numMedia = parseInt((formData.get("NumMedia") as string | null) ?? "0");
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const toNumber = (formData.get("To") as string | null) ?? "";
  const body = (formData.get("Body") as string | null)?.trim() ?? "";

  // ── Status lookup: user texts an AZ- reference number ─────────────────────
  if (numMedia === 0 && body.toUpperCase().startsWith("AZ-")) {
    const invoice = await prisma.invoice.findUnique({
      where: { referenceNo: body.toUpperCase() },
      include: {
        extractedData: {
          where: { fieldName: { in: ["total", "currency"] } },
          select: { fieldName: true, value: true },
        },
      },
    });

    if (invoice) {
      const total = invoice.extractedData.find((f) => f.fieldName === "total");
      const currency = invoice.extractedData.find((f) => f.fieldName === "currency");
      const totalStr =
        total?.value && currency?.value
          ? `${currency.value} ${Number(total.value).toFixed(2)}`
          : total?.value ?? "—";

      await sendWhatsAppReply(
        from, toNumber,
        `📄 Invoice *${body.toUpperCase()}*\nStatus: ${invoice.status.toUpperCase()}\nAmount: ${totalStr}`,
        accountSid, authToken
      );
    } else {
      await sendWhatsAppReply(
        from, toNumber,
        `Reference *${body}* not found. Please check and try again.`,
        accountSid, authToken
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (numMedia === 0) {
    // No media and not a status query — send help
    await sendWhatsAppReply(
      from,
      toNumber,
      "Hi! To submit an invoice, please send an image or PDF file. 📄\n\nTo check the status of an invoice, reply with your reference number (e.g. *AZ-2025-A1B2C3*).",
      accountSid,
      authToken
    );
    return NextResponse.json({ message: "No media" }, { status: 200 });
  }

  let firstRefNo = "";

  for (let i = 0; i < numMedia; i++) {
    const mediaUrl = (formData.get(`MediaUrl${i}`) as string | null) ?? "";
    const mediaContentType =
      (formData.get(`MediaContentType${i}`) as string | null) ?? "";

    const ACCEPTED_TYPES = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/tiff",
    ];
    if (!ACCEPTED_TYPES.includes(mediaContentType)) {
      console.log(`[WhatsApp] Skipping unsupported media type: ${mediaContentType}`);
      continue;
    }

    // Download media from Twilio
    let buffer: Buffer;
    try {
      const authString = Buffer.from(`${accountSid}:${authToken}`).toString(
        "base64"
      );
      const res = await fetch(mediaUrl, {
        headers: { Authorization: `Basic ${authString}` },
      });
      if (!res.ok) throw new Error(`Failed to download media: ${res.status}`);
      buffer = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      console.error("[WhatsApp] Failed to download media:", err);
      continue;
    }

    const referenceNo = generateReferenceNo();
    const EXT_MAP: Record<string, string> = {
      "application/pdf": "pdf",
      "image/jpeg":      "jpg",
      "image/png":       "png",
      "image/webp":      "webp",
      "image/heic":      "heic",
      "image/tiff":      "tiff",
    };
    const ext = EXT_MAP[mediaContentType] ?? "jpg";

    const stored = await storeFile(
      buffer,
      `whatsapp-${referenceNo}.${ext}`,
      mediaContentType,
      "whatsapp"
    );

    const invoice = await prisma.invoice.create({
      data: {
        referenceNo,
        channel: "whatsapp",
        status: "processing",
        fileUrl: stored.url,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        fileSize: stored.fileSize,
        submittedBy: from || null,
      },
    });

    await prisma.ingestionEvent.create({
      data: {
        invoiceId: invoice.id,
        eventType: "received",
        metadata: JSON.stringify({
          channel: "whatsapp",
          from,
          mediaIndex: i,
          mediaContentType,
        }),
      },
    });

    if (!firstRefNo) firstRefNo = referenceNo;

    // Extract async, then reply — fallback ensures invoice never stays stuck in "processing"
    // if processWhatsAppInvoice throws before its own try/catch (e.g. getSettings fails).
    processWhatsAppInvoice(
      invoice.id,
      buffer,
      stored.mimeType,
      from,
      toNumber,
      referenceNo,
      accountSid,
      authToken
    ).catch(async (err) => {
      console.error(`[WhatsApp Extract] Failed for invoice ${invoice.id}:`, err);
      try {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: "error", flags: JSON.stringify(["extraction_failed"]) },
        });
      } catch (updateErr) {
        console.error(`[WhatsApp Extract] Failed to mark invoice ${invoice.id} as error:`, updateErr);
      }
    });
  }

  if (firstRefNo) {
    await sendWhatsAppReply(
      from,
      toNumber,
      `✅ Invoice received! Your reference number is *${firstRefNo}*.\n\nWe're processing it now. Reply with your reference number any time to check the status.`,
      accountSid,
      authToken
    );
  }

  return NextResponse.json({ ok: true });
}

async function processWhatsAppInvoice(
  invoiceId: string,
  buffer: Buffer,
  mimeType: string,
  from: string,
  toNumber: string,
  referenceNo: string,
  accountSid: string | undefined,
  authToken: string | undefined
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
          data: { name: vendorNameValue.trim(), phone: from || null },
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

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "extracted", processedAt: new Date(), vendorId },
    });

    // Reply with extracted total
    const total = extraction.total?.value;
    const currency = extraction.currency?.value;
    if (total != null && from) {
      await sendWhatsAppReply(
        from,
        toNumber,
        `✅ Extraction complete for *${referenceNo}*\nAmount: ${currency ?? ""} ${Number(total).toFixed(2)}`,
        accountSid,
        authToken
      );
    }
  } catch (err) {
    console.error("[WhatsApp Extract]", err);
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: "error" },
    });
  }
}

async function sendWhatsAppReply(
  to: string,
  from: string,
  message: string,
  accountSid: string | undefined,
  authToken: string | undefined
) {
  if (!accountSid || !authToken) {
    console.log(`[WhatsApp] Would send to ${to}: ${message}`);
    return;
  }

  try {
    await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: from, To: to, Body: message }),
      }
    );
  } catch (err) {
    console.error("[WhatsApp] Failed to send reply:", err);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EXTRACTION_SYSTEM_PROMPT } from "@/lib/extraction-prompt";

export const dynamic = "force-dynamic";

const USER_PROMPT_PREFIX = `Analyse the invoice text below and extract all structured data.
Return ONLY valid JSON — no preamble, no markdown fences, no explanation.

Invoice text:
`;

/**
 * POST /api/fine-tune/export
 *
 * Builds a JSONL file (OpenAI fine-tuning format) from all invoices where
 * fineTuneStatus = "READY".  After a successful export, those invoices are
 * optionally marked as "UPLOADED" so they are not exported again.
 *
 * Body (JSON, all optional):
 *   markUploaded  boolean  — default true.  Set false to preview without
 *                            changing status.
 *   ids           string[] — export only these invoice IDs instead of all
 *                            READY invoices.
 *
 * Returns the JSONL file as application/jsonl with a content-disposition
 * attachment header, plus custom headers:
 *   X-Exported-Count  — number of examples included in the file
 *   X-Skipped-Count   — number of READY invoices skipped (missing correctedData)
 */
export async function POST(request: NextRequest) {
  let markUploaded = true;
  let ids: string[] | undefined;

  try {
    const body = await request.json();
    if (typeof body.markUploaded === "boolean") markUploaded = body.markUploaded;
    if (Array.isArray(body.ids) && body.ids.length > 0) ids = body.ids as string[];
  } catch {
    // Body is optional — ignore parse errors
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      fineTuneStatus: "READY",
      ...(ids ? { id: { in: ids } } : {}),
    },
    select: {
      id: true,
      ocrText: true,
      correctedData: true,
    },
    orderBy: { updatedAt: "asc" },
  });

  if (invoices.length === 0) {
    return NextResponse.json(
      { error: "No READY invoices found. Mark invoices as READY before exporting." },
      { status: 404 }
    );
  }

  const exported: string[] = [];
  const skipped: string[] = [];
  const lines: string[] = [];

  for (const inv of invoices) {
    if (!inv.correctedData) {
      // Cannot build a valid training example without the corrected output
      skipped.push(inv.id);
      continue;
    }

    // Validate correctedData is parseable JSON before embedding it
    try {
      JSON.parse(inv.correctedData);
    } catch {
      skipped.push(inv.id);
      continue;
    }

    const ocrText = inv.ocrText?.trim()
      ? inv.ocrText
      : "[No OCR text stored for this invoice — document was processed without OCR]";

    const example = {
      messages: [
        {
          role: "system",
          content: EXTRACTION_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: USER_PROMPT_PREFIX + ocrText,
        },
        {
          role: "assistant",
          // correctedData is already a serialised JSON string — embed as-is
          // so the assistant response is valid JSON (required by OpenAI fine-tuning)
          content: inv.correctedData,
        },
      ],
    };

    lines.push(JSON.stringify(example));
    exported.push(inv.id);
  }

  if (exported.length === 0) {
    return NextResponse.json(
      {
        error:
          "All READY invoices are missing correctedData and were skipped. " +
          "Open each invoice in the Dashboard, make at least one correction, " +
          "and save before exporting.",
        skipped,
      },
      { status: 422 }
    );
  }

  // Mark exported invoices as UPLOADED so they won't be included in future exports
  if (markUploaded) {
    await prisma.invoice.updateMany({
      where: { id: { in: exported } },
      data: { fineTuneStatus: "UPLOADED" },
    });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const jsonl = lines.join("\n");

  return new NextResponse(jsonl, {
    status: 200,
    headers: {
      "Content-Type": "application/jsonl",
      "Content-Disposition": `attachment; filename="fine-tune-${timestamp}.jsonl"`,
      "X-Exported-Count": String(exported.length),
      "X-Skipped-Count": String(skipped.length),
    },
  });
}

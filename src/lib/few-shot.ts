/**
 * Few-shot learning injection for invoice extraction.
 *
 * When a new invoice is extracted, this module queries the CorrectionLog table
 * for recent field-level corrections made by admins and formats them as a
 * prompt section injected into the GPT-4o-mini system prompt.
 *
 * Priority:
 *   1. Corrections for the detected vendor (most relevant)
 *   2. Padded with general recent corrections across all invoices
 *
 * This provides immediate improvement with no extra API calls.
 */

import { prisma } from "./prisma";

const MAX_EXAMPLES = 12;

/**
 * Build the few-shot section string to inject into the extraction system prompt.
 *
 * @param ocrText  The cleaned OCR text of the document being extracted.
 *                 Used to detect a known vendor via name matching.
 * @returns        A formatted string to append to the system prompt,
 *                 or "" if there are no corrections to inject.
 */
export async function buildFewShotSection(ocrText: string): Promise<string> {
  // ── Detect known vendor in the OCR text ─────────────────────────────────────
  const vendors = await prisma.vendor.findMany({
    select: { id: true, name: true },
    take: 500,
  });

  const ocrLower = ocrText.toLowerCase();
  const matchedVendor = vendors.find((v) =>
    v.name.length > 3 && ocrLower.includes(v.name.toLowerCase())
  );

  // ── Fetch vendor-specific corrections (if any) ───────────────────────────────
  let corrections: Array<{
    fieldName: string;
    originalValue: string | null;
    correctedValue: string | null;
  }> = [];

  if (matchedVendor) {
    corrections = await prisma.correctionLog.findMany({
      where: {
        invoice: { vendorId: matchedVendor.id },
        correctedValue: { not: null },
      },
      orderBy: { correctedAt: "desc" },
      take: MAX_EXAMPLES,
      select: { fieldName: true, originalValue: true, correctedValue: true },
    });
  }

  // ── Pad with general corrections if not enough vendor-specific ones ───────────
  if (corrections.length < MAX_EXAMPLES) {
    const excludeVendorId = matchedVendor?.id;
    const general = await prisma.correctionLog.findMany({
      where: {
        correctedValue: { not: null },
        ...(excludeVendorId
          ? { invoice: { vendorId: { not: excludeVendorId } } }
          : {}),
      },
      orderBy: { correctedAt: "desc" },
      take: MAX_EXAMPLES - corrections.length,
      select: { fieldName: true, originalValue: true, correctedValue: true },
    });
    corrections = [...corrections, ...general];
  }

  if (corrections.length === 0) return "";

  // ── Deduplicate by fieldName + originalValue ──────────────────────────────────
  const seen = new Set<string>();
  const unique = corrections.filter((c) => {
    const key = `${c.fieldName}:${c.originalValue ?? "null"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // ── Format ───────────────────────────────────────────────────────────────────
  const headerLabel = matchedVendor
    ? `PAST CORRECTIONS FOR "${matchedVendor.name.toUpperCase()}"`
    : "PAST CORRECTIONS (GENERAL)";

  const lines = unique.map(
    (c) =>
      `• ${c.fieldName}: extracted "${c.originalValue ?? "null"}" → correct: "${c.correctedValue}"`
  );

  return [
    "",
    `══ ${headerLabel} ═══════════════════════════════════════════════`,
    "The following field values were corrected by a human reviewer.",
    "If you encounter similar values, apply these corrections:",
    ...lines,
    "═══════════════════════════════════════════════════════════════════════════",
  ].join("\n");
}

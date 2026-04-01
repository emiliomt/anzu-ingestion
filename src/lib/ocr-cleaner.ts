/**
 * 8-step OCR text cleaning pipeline for Spanish / Colombian invoice text.
 *
 * Designed to normalise raw OCR output before it is sent to an LLM for
 * structured extraction.  Each step is kept small and deterministic so the
 * transformation is easy to audit and tune.
 */

// ── Step 1: Fix OCR character errors ─────────────────────────────────────────
function fixOcrErrors(text: string): string {
  // Context-aware S ↔ 5: when directly adjacent to a digit, treat as 5
  text = text.replace(/([0-9])S([0-9])/g, "$15$2");  // between digits
  text = text.replace(/([0-9])S(?=\s|$|[^\w])/g, "$15"); // trailing after digit
  text = text.replace(/\bS([0-9])/g, "5$1"); // word-boundary S before digit

  // Pipe / uppercase-I / lowercase-l in purely numeric context → 1
  text = text.replace(/([0-9])[|Il]([0-9])/g, "$11$2");

  return text;
}

// ── Step 2: Normalize whitespace ──────────────────────────────────────────────
function normalizeWhitespace(text: string): string {
  text = text.replace(/ {2,}/g, " ");       // multiple spaces → one
  text = text.replace(/\n{3,}/g, "\n\n");   // 3+ blank lines → one blank line
  return text.trim();
}

// ── Step 3: Fix Spanish invoice terminology ───────────────────────────────────
const TERMINOLOGY: [RegExp, string][] = [
  [/\b(Eml50r|Em150r|EmI50r)\b/gi, "Emisor"],
  [/\b(Factur4|F4ctura|Fáctura)\b/gi, "Factura"],
  [/\b(Fech4|Fécha)\b/gi, "Fecha"],
  [/\b(Tot4l|Tótāl)\b/gi, "Total"],
  [/\b(Subtot4l|Sub-total)\b/gi, "Subtotal"],
  [/\b(lVA|IVÁ)\b/gi, "IVA"],
  [/\b(NlT|N1T)\b/gi, "NIT"],
  [/\b(Proveed0r|Prōveedor)\b/gi, "Proveedor"],
  [/\b(Cllente|ClIente)\b/gi, "Cliente"],
  [/\b(Adquirlente|Adquiriénte)\b/gi, "Adquiriente"],
  [/\b(0bra|Óbra)\b/gi, "Obra"],
  [/\b(Proyect0|Próyecto)\b/gi, "Proyecto"],
  [/\b(Compañl4)\b/gi, "Compañía"],
  [/\b(Dlrección|Dirécción)\b/gi, "Dirección"],
];

function fixSpanishTerminology(text: string): string {
  for (const [pattern, replacement] of TERMINOLOGY) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

// ── Step 4: Fix Colombian currency / number formatting ────────────────────────
function fixNumberFormats(text: string): string {
  // 3-group thousands: 1.234.567,89 → 1234567.89
  text = text.replace(
    /\b(\d{1,3})\.(\d{3})\.(\d{3}),(\d{1,2})\b/g,
    (_, a, b, c, dec) => `${a}${b}${c}.${dec}`
  );
  // 3-group no decimal: 1.234.567 → 1234567
  text = text.replace(
    /\b(\d{1,3})\.(\d{3})\.(\d{3})\b/g,
    (_, a, b, c) => `${a}${b}${c}`
  );
  // 2-group: 1.234,56 → 1234.56  (European: period=thousands, comma=decimal)
  text = text.replace(
    /\b(\d{1,3})\.(\d{3}),(\d{2})\b/g,
    (_, a, b, dec) => `${a}${b}.${dec}`
  );
  // Bare decimal comma with exactly 2 decimal places: 1234,89 → 1234.89
  text = text.replace(/\b(\d+),(\d{2})\b/g, "$1.$2");

  return text;
}

// ── Step 5: Normalize dates ───────────────────────────────────────────────────
const SPANISH_MONTHS: Record<string, string> = {
  enero: "01", febrero: "02", marzo: "03", abril: "04",
  mayo: "05", junio: "06", julio: "07", agosto: "08",
  septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
};

function normalizeDates(text: string): string {
  // DD/MM/YYYY or DD-MM-YYYY → YYYY-MM-DD
  text = text.replace(
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g,
    (_, d, m, y) => `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  );

  // "15 de marzo de 2024" → "2024-03-15"
  const monthNames = Object.keys(SPANISH_MONTHS).join("|");
  const spanishDateRe = new RegExp(
    `\\b(\\d{1,2})\\s+de\\s+(${monthNames})\\s+de\\s+(\\d{4})\\b`,
    "gi"
  );
  text = text.replace(spanishDateRe, (_, d, m, y) => {
    const month = SPANISH_MONTHS[m.toLowerCase()];
    return `${y}-${month}-${String(d).padStart(2, "0")}`;
  });

  return text;
}

// ── Step 6: Inject structural markers ────────────────────────────────────────
function injectStructuralMarkers(text: string): string {
  // Vendor/issuer section
  text = text.replace(
    /\b(Emisor|EMISOR)\b/g,
    "\n=== INFORMACIÓN DEL EMISOR ===\n$1"
  );
  // Buyer section
  text = text.replace(
    /\b(Adquiriente|ADQUIRIENTE|Cliente|CLIENTE)\b/g,
    "\n=== INFORMACIÓN DEL ADQUIRIENTE ===\n$1"
  );
  // Invoice header
  text = text.replace(
    /\b(Factura\s+(?:No|N[uú]mero|Nro)\.?\s*\d+|No\.\s*Factura\s*\d+)/gi,
    "\n=== DATOS DE LA FACTURA ===\n$1"
  );
  // NIT lines
  text = text.replace(/\b(NIT\s*[:.]?\s*\d)/g, "\n--- NIT ---\n$1");
  // Monetary totals
  text = text.replace(
    /\b(Total[^:\n]{0,20}[:]\s*\$?\s*[\d.,]+)/gi,
    "\n--- TOTAL ---\n$1"
  );
  text = text.replace(
    /\b(IVA[^:\n]{0,20}[:]\s*\$?\s*[\d.,]+)/gi,
    "\n--- IVA ---\n$1"
  );
  text = text.replace(
    /\b(Subtotal[^:\n]{0,20}[:]\s*\$?\s*[\d.,]+)/gi,
    "\n--- SUBTOTAL ---\n$1"
  );

  return text;
}

// ── Step 7: Fix Colombian address patterns ────────────────────────────────────
function fixAddressPatterns(text: string): string {
  text = text.replace(/\b(CLL\.?|Cl\.?|CALLE)\s+/gi, "Calle ");
  text = text.replace(/\b(CRA\.?|Cr\.?|CARRERA)\s+/gi, "Carrera ");
  text = text.replace(/\b(DG\.?|DIAGONAL)\s+/gi, "Diagonal ");
  text = text.replace(/\b(AV\.?|AVENIDA)\s+/gi, "Avenida ");
  text = text.replace(/\b(KM\.?|KILÓMETRO)\s+/gi, "Km ");
  text = text.replace(/\b(TV\.?|TRANSVERSAL)\s+/gi, "Transversal ");
  return text;
}

// ── Step 8: Final cleanup ─────────────────────────────────────────────────────
function finalCleanup(text: string): string {
  text = text.replace(/ +/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

// ── Public API ────────────────────────────────────────────────────────────────
/**
 * Run the full 8-step OCR cleaning pipeline on raw invoice OCR text.
 * Returns cleaned text suitable for LLM extraction.
 */
export function cleanOcrText(rawText: string): string {
  let text = rawText;
  text = fixOcrErrors(text);
  text = normalizeWhitespace(text);
  text = fixSpanishTerminology(text);
  text = fixNumberFormats(text);
  text = normalizeDates(text);
  text = injectStructuralMarkers(text);
  text = fixAddressPatterns(text);
  text = finalCleanup(text);
  return text;
}

/**
 * Colombian UBL 2.1 electronic invoice XML parser.
 *
 * Handles:
 *   • <AttachedDocument> wrappers (DIAN CDATA-embedded inner XML)
 *   • Both cbc:/cac: prefixed and un-prefixed tags
 *   • AccountingSupplierParty + AccountingCustomerParty
 *   • Colombian NIT tax IDs
 *   • Smart invoice-number selection (avoids CUFE/CUDE UUIDs)
 *   • Colombian / US number formats, capped at 99,999,999.99
 *   • InvoiceLine + CreditNoteLine elements
 *
 * Returns an InvoiceExtraction with confidence 0.95 for parsed fields.
 * No AI call is made — this is pure deterministic XML parsing.
 */

import type { InvoiceExtraction, ExtractionField, LineItemExtraction } from "./claude";

// ── Low-level XML helpers ────────────────────────────────────────────────────

/** Return the trimmed text content of the first matching tag (any namespace prefix). */
function getTagText(xml: string, tag: string): string | null {
  for (const prefix of ["cbc:", "cac:", "sts:", ""]) {
    const re = new RegExp(`<${prefix}${tag}(?:\\s[^>]*)?>([^<]+)</${prefix}${tag}>`, "i");
    const m = xml.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

/** Return the value of an XML attribute on a tag. */
function getTagAttr(xml: string, tag: string, attr: string): string | null {
  const re = new RegExp(
    `<(?:cbc:|cac:|sts:|)${tag}(?:\\s[^>]*)?\\s${attr}="([^"]*)"`,
    "i"
  );
  const m = xml.match(re);
  return m?.[1] ?? null;
}

/** Extract CDATA section content (returns null if no CDATA found). */
function extractCDATA(xml: string): string | null {
  const m = xml.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m?.[1] ?? null;
}

// ── Party parsing ─────────────────────────────────────────────────────────────

interface PartyInfo {
  name: string | null;
  taxId: string | null;
  address: string | null;
}

function parseParty(xml: string, tagName: string): PartyInfo {
  // Locate the party block (first match of the tag, namespaced or not)
  const startRe = new RegExp(`<(?:cac:|)${tagName}[\\s>]`, "i");
  const startMatch = startRe.exec(xml);
  if (!startMatch) return { name: null, taxId: null, address: null };

  const closeTag = `</${tagName}>`;
  const start = startMatch.index;
  const end = xml.indexOf(closeTag, start);
  const block = end !== -1 ? xml.slice(start, end + closeTag.length) : xml.slice(start);

  const name =
    getTagText(block, "RegistrationName") ??
    getTagText(block, "Name") ??
    getTagText(block, "CompanyName");

  // Tax ID: prefer CompanyID over generic ID (ID appears on many elements)
  const taxId =
    getTagText(block, "CompanyID") ??
    getTagText(block, "TaxSchemeID");

  // Build address from UBL address fields
  const addressParts = [
    getTagText(block, "StreetName"),
    getTagText(block, "AdditionalStreetName"),
    getTagText(block, "CityName"),
    getTagText(block, "CountrySubentity"),
    getTagText(block, "PostalZone"),
  ].filter(Boolean);

  return {
    name,
    taxId,
    address: addressParts.length > 0 ? addressParts.join(", ") : null,
  };
}

// ── Invoice number selection ──────────────────────────────────────────────────

/**
 * Pick the best invoice number from several candidate fields.
 * Scores candidates so we prefer short, human-readable IDs and avoid
 * CUFE/CUDE UUIDs (long hex strings).
 */
function bestInvoiceNumber(xml: string): string | null {
  const candidateFields = [
    "InvoiceNumber",
    "SerieNumber",
    "SerialNumber",
    "Number",
    "InvoiceID",
    "DocumentID",
    "ParentDocumentID",
    "ID",
  ];

  const scored: { value: string; score: number }[] = [];

  for (const field of candidateFields) {
    const value = getTagText(xml, field);
    if (!value || value.length > 60) continue;

    let score = 0;
    if (/\d/.test(value)) score += 2;                         // contains digits
    if (/^(FE|INV|FACT|DOC|NC|ND)/i.test(value)) score += 3; // known prefix
    if (value.length >= 2 && value.length <= 20) score += 2;  // reasonable length
    if (/^[0-9a-f]{32,}$/i.test(value)) score -= 20;          // penalise raw UUIDs (CUFE/CUDE)

    scored.push({ value, score });
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  return scored[0].value;
}

// ── Amount parsing ────────────────────────────────────────────────────────────

/**
 * Parse a number string that may use Colombian (1.234.567,89),
 * European (1.234,56), or US (1,234.56) formatting.
 * Returns null on failure; result capped at 99,999,999.99 to prevent DB overflow.
 */
function parseAmount(raw: string | null): number | null {
  if (!raw) return null;
  let s = raw.replace(/[$\s€£]/g, "");

  if (/\d\.\d{3}/.test(s) && s.includes(",")) {
    // Colombian/European: period=thousands, comma=decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/\d\.\d{3}/.test(s)) {
    // Only periods (thousands separator with no decimal)
    s = s.replace(/\./g, "");
  } else {
    // US format or bare number — remove commas
    s = s.replace(/,/g, "");
  }

  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return Math.min(n, 99_999_999.99);
}

// ── Field builder ─────────────────────────────────────────────────────────────

function field(
  value: string | number | null,
  confidence = 0.95
): ExtractionField {
  return { value, confidence };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a Colombian UBL XML electronic invoice into an InvoiceExtraction.
 *
 * Handles <AttachedDocument> wrappers by extracting the embedded XML from
 * the CDATA block inside <cbc:Description>.
 *
 * Confidence is set to 0.95 for fields that were successfully parsed, and
 * 0 for fields that were not found (so they appear as null / not-extracted).
 */
export function parseInvoiceXML(xmlContent: string): InvoiceExtraction {
  let xml = xmlContent;

  // ── Unwrap AttachedDocument ──────────────────────────────────────────────
  if (/<AttachedDocument[\s>]/i.test(xml)) {
    const descMatch = xml.match(
      /<cbc:Description[^>]*>([\s\S]*?)<\/cbc:Description>/i
    );
    if (descMatch) {
      const cdata = extractCDATA(descMatch[1]);
      if (cdata) xml = cdata;
    }
  }

  // ── Parties ──────────────────────────────────────────────────────────────
  const supplier =
    parseParty(xml, "cac:AccountingSupplierParty") ||
    parseParty(xml, "AccountingSupplierParty");

  const customer =
    parseParty(xml, "cac:AccountingCustomerParty") ||
    parseParty(xml, "AccountingCustomerParty");

  // ── Invoice metadata ──────────────────────────────────────────────────────
  const invoiceNumber = bestInvoiceNumber(xml);
  const issueDate = getTagText(xml, "IssueDate");
  const dueDate =
    getTagText(xml, "DueDate") ?? getTagText(xml, "PaymentDueDate");

  // ── Currency ──────────────────────────────────────────────────────────────
  const currency =
    getTagAttr(xml, "PayableAmount", "currencyID") ??
    getTagAttr(xml, "TaxInclusiveAmount", "currencyID") ??
    getTagAttr(xml, "LineExtensionAmount", "currencyID") ??
    getTagText(xml, "DocumentCurrencyCode") ??
    "COP"; // Default for Colombian invoices

  // ── Monetary amounts ──────────────────────────────────────────────────────
  const total = parseAmount(
    getTagText(xml, "PayableAmount") ??
    getTagText(xml, "TaxInclusiveAmount")
  );

  const tax = parseAmount(
    getTagText(xml, "TaxAmount")
  );

  const subtotal = parseAmount(
    getTagText(xml, "TaxExclusiveAmount") ??
    getTagText(xml, "LineExtensionAmount")
  );

  // ── Payment / bank ────────────────────────────────────────────────────────
  const paymentMeans =
    getTagText(xml, "PaymentMeansCode") ??
    getTagText(xml, "InstructionNote") ?? null;

  const bankParts = [
    getTagText(xml, "FinancialInstitutionBranch"),
    getTagText(xml, "FinancialInstitutionCode"),
    getTagText(xml, "AccountID"),
  ].filter(Boolean);
  const bankDetails = bankParts.length > 0 ? bankParts.join(" · ") : null;

  // ── Line items ────────────────────────────────────────────────────────────
  const lineItems: LineItemExtraction[] = [];
  const lineRe =
    /<cac:(?:Invoice|CreditNote)Line>([\s\S]*?)<\/cac:(?:Invoice|CreditNote)Line>/gi;
  let m: RegExpExecArray | null;

  while ((m = lineRe.exec(xml)) !== null) {
    const block = m[1];
    const qtyRaw =
      getTagText(block, "InvoicedQuantity") ??
      getTagText(block, "CreditedQuantity");
    const qty = qtyRaw ? parseFloat(qtyRaw) : null;

    lineItems.push({
      description:
        getTagText(block, "Description") ?? getTagText(block, "Name"),
      quantity: qty != null && !isNaN(qty) ? qty : null,
      unit_price: parseAmount(getTagText(block, "PriceAmount")),
      line_total: parseAmount(getTagText(block, "LineExtensionAmount")),
      confidence: 0.95,
    });
  }

  // ── Assemble result ───────────────────────────────────────────────────────
  return {
    vendor_name:    field(supplier.name),
    vendor_address: field(supplier.address),
    vendor_tax_id:  field(supplier.taxId, supplier.taxId ? 0.95 : 0),
    invoice_number: field(invoiceNumber),
    issue_date:     field(issueDate ?? null),
    due_date:       field(dueDate ?? null),
    subtotal:       field(subtotal),
    tax:            field(tax),
    total:          field(total),
    currency:       field(currency),
    po_reference:   field(null, 0),
    payment_terms:  field(paymentMeans, paymentMeans ? 0.80 : 0),
    bank_details:   field(bankDetails, bankDetails ? 0.85 : 0),
    buyer_name:     field(customer.name, customer.name ? 0.95 : 0),
    buyer_tax_id:   field(customer.taxId, customer.taxId ? 0.95 : 0),
    buyer_address:  field(customer.address, customer.address ? 0.90 : 0),
    line_items:     lineItems,
  };
}

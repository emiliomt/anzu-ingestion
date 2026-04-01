/**
 * Client for the anzu-security middleware service.
 *
 * Called after OCR extraction completes. Sends the extracted invoice data
 * to anzu-security for:
 *   1. Buyer field verification (name, tax ID, address)
 *   2. SAT Art.69-B EFOS blacklist check (Mexican invoices only)
 *
 * If the security check fails, the invoice is flagged with "security_failed"
 * and the caller should update the DB accordingly.
 *
 * Configure via environment variables:
 *   SECURITY_SERVICE_URL  — e.g. https://anzu-security.railway.app
 *   SECURITY_API_KEY      — X-Api-Key header value (optional)
 *   SECURITY_ORG_ID       — org identifier passed to anzu-security (default: "default")
 */

interface ExtractionFieldPayload {
  value: string | number | null;
  confidence: number;
  is_uncertain?: boolean;
}

interface LineItemPayload {
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  line_total: number | null;
  category: string | null;
  confidence: number;
}

export interface SecurityPayload {
  invoice_id:   string;
  reference_no: string;
  channel:      string;
  org_id:       string;

  vendor_name?:    ExtractionFieldPayload;
  vendor_tax_id?:  ExtractionFieldPayload;
  vendor_address?: ExtractionFieldPayload;

  buyer_name?:    ExtractionFieldPayload;
  buyer_tax_id?:  ExtractionFieldPayload;
  buyer_address?: ExtractionFieldPayload;

  invoice_number?: ExtractionFieldPayload;
  issue_date?:     ExtractionFieldPayload;
  due_date?:       ExtractionFieldPayload;
  subtotal?:       ExtractionFieldPayload;
  tax?:            ExtractionFieldPayload;
  total?:          ExtractionFieldPayload;
  currency?:       ExtractionFieldPayload;
  po_reference?:   ExtractionFieldPayload;
  payment_terms?:  ExtractionFieldPayload;
  bank_details?:   ExtractionFieldPayload;

  concept?:          ExtractionFieldPayload;
  project_name?:     ExtractionFieldPayload;
  project_address?:  ExtractionFieldPayload;
  project_city?:     ExtractionFieldPayload;
  notes?:            ExtractionFieldPayload;

  line_items?: LineItemPayload[];
  custom_fields?: Record<string, ExtractionFieldPayload>;
}

export interface SecurityCheckResult {
  invoice_id:   string;
  reference_no: string;
  passed:       boolean;
  risk_level:   "low" | "medium" | "high";
  failure_reasons: string[];
  forwarded:    boolean;
  message:      string;
}

const SECURITY_URL     = process.env.SECURITY_SERVICE_URL ?? "";
const SECURITY_API_KEY = process.env.SECURITY_API_KEY     ?? "";
const SECURITY_ORG_ID  = process.env.SECURITY_ORG_ID      ?? "default";
const TIMEOUT_MS       = 30_000;

/**
 * Send invoice data to anzu-security for verification.
 * Returns null if the service is not configured (SECURITY_SERVICE_URL unset).
 * Never throws — all errors are caught and logged.
 */
export async function runSecurityCheck(
  payload: Omit<SecurityPayload, "org_id">
): Promise<SecurityCheckResult | null> {
  if (!SECURITY_URL) {
    // Service not configured — skip silently
    return null;
  }

  const body: SecurityPayload = { ...payload, org_id: SECURITY_ORG_ID };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (SECURITY_API_KEY) {
    headers["X-Api-Key"] = SECURITY_API_KEY;
  }

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const resp = await fetch(`${SECURITY_URL}/api/v1/check`, {
      method:  "POST",
      headers,
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      const text = await resp.text().catch(() => "(unreadable)");
      console.error(
        `[Security] Service returned ${resp.status} for invoice ${payload.invoice_id}: ${text.slice(0, 200)}`
      );
      return null;
    }

    return (await resp.json()) as SecurityCheckResult;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error(`[Security] Check failed for invoice ${payload.invoice_id}:`, err);
    return null;
  }
}

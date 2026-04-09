// Anzu Dynamics — Application Settings (multi-tenant)
// Persists key-value configuration in the `settings` table, scoped by organizationId.
//
// Resolution order (most-specific wins):
//   1. Tenant-specific row:  { organizationId: orgId, key }
//   2. Global default row:   { organizationId: "default", key }
//   3. Hard-coded fallback:  SETTING_DEFAULTS[key]
//
// Usage:
//   import { getSettings } from "@/lib/app-settings";
//   const settings = await getSettings(orgId);         // tenant-scoped
//   const settings = await getSettings();              // global fallback only

import { prisma } from "./prisma";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AppSettings {
  // ── Regional defaults ─────────────────────────────────────────────────────
  /** ISO 3166-1 alpha-2 country code used as context for currency inference */
  default_country: string;
  /** ISO 4217 currency code — fallback when currency cannot be inferred from doc */
  default_currency: string;
  /** Document language for OCR cleaning and prompt tuning: "auto" | "es" | "en" | "pt" */
  document_language: string;
  /** Number format convention used in documents: "auto" | "latin_american" | "us" */
  amount_format: string;

  // ── Extraction behaviour ─────────────────────────────────────────────────
  /** Fields below this confidence score trigger a low_confidence flag (0.50–0.95) */
  low_confidence_threshold: number;
  /** Extraction call timeout in seconds (10–60) */
  extraction_timeout_seconds: number;
  /**
   * If every core field is ≥ this value, auto-set status to "reviewed".
   * null = disabled.
   */
  auto_approve_threshold: number | null;
  /** Whether to detect and flag duplicate invoices */
  flag_duplicates: boolean;

  // ── Fine-tuning ───────────────────────────────────────────────────────────
  /**
   * Fine-tuned model ID (e.g. "ft:gpt-4o-mini-2024-07-18:anzu-invoice:xxxx").
   * When set, extraction uses this model instead of gpt-4o-mini.
   * null = not fine-tuned yet.
   */
  finetune_model_id: string | null;

  // ── Field selection ───────────────────────────────────────────────────────
  extraction_fields: string[];

  // ── ERP preference ────────────────────────────────────────────────────────
  /** Preferred ERP type set during onboarding: "sinco" | "siigo" | "sap_b1" | "contpaq" | "other" */
  preferred_erp: string | null;
}

// ── All extractable field keys ─────────────────────────────────────────────────

export const ALL_EXTRACTION_FIELDS = [
  "vendor_name", "vendor_address", "invoice_number", "issue_date", "due_date",
  "subtotal", "tax", "total", "currency", "po_reference", "payment_terms", "bank_details",
  "vendor_tax_id", "buyer_name", "buyer_tax_id", "buyer_address",
  "concept", "project_name", "project_address", "project_city", "notes", "line_items",
] as const;

// ── Defaults (used when no DB row exists for a key) ────────────────────────────

export const SETTING_DEFAULTS: AppSettings = {
  default_country:            "CO",
  default_currency:           "COP",
  document_language:          "es",
  amount_format:              "auto",
  low_confidence_threshold:   0.85,
  extraction_timeout_seconds: 45,
  auto_approve_threshold:     null,
  flag_duplicates:            true,
  finetune_model_id:          null,
  extraction_fields:          [...ALL_EXTRACTION_FIELDS],
  preferred_erp:              null,
};

// ── Country → default currency map ────────────────────────────────────────────

export const COUNTRY_CURRENCY: Record<string, string> = {
  CO: "COP", MX: "MXN", AR: "ARS", CL: "CLP", PE: "PEN",
  BO: "BOB", PY: "PYG", UY: "UYU", VE: "VES", EC: "USD",
  PA: "USD", CR: "CRC", DO: "DOP", GT: "GTQ", HN: "HNL",
  SV: "USD", NI: "NIO", CU: "CUP",
  US: "USD", CA: "CAD",
  GB: "GBP",
  ES: "EUR", FR: "EUR", DE: "EUR", IT: "EUR", PT: "EUR",
  NL: "EUR", BE: "EUR", AT: "EUR", CH: "CHF",
  BR: "BRL",
  CN: "CNY", JP: "JPY", KR: "KRW", IN: "INR",
  AU: "AUD", NZ: "NZD",
};

// ── Read ───────────────────────────────────────────────────────────────────────

/**
 * Loads settings for the given organization with a 3-level fallback:
 *   org-specific → "default" global row → SETTING_DEFAULTS hard-coded values.
 *
 * @param organizationId  Clerk org ID. Pass null/undefined for global-only lookup.
 */
export async function getSettings(organizationId?: string | null): Promise<AppSettings> {
  // Load all rows matching either this org or the "default" global org
  const orgsToQuery = ["default"];
  if (organizationId) orgsToQuery.push(organizationId);

  const rows = await prisma.setting.findMany({
    where: { organizationId: { in: orgsToQuery } },
  });

  // Build a merged map: org-specific values win over "default"
  const map: Record<string, string> = {};
  // Apply "default" rows first
  for (const row of rows) {
    if (row.organizationId === "default") map[row.key] = row.value;
  }
  // Apply org-specific rows second (overwrite defaults)
  if (organizationId) {
    for (const row of rows) {
      if (row.organizationId === organizationId) map[row.key] = row.value;
    }
  }

  const get = (key: string): string | undefined => map[key];

  return {
    default_country:  get("default_country")  ?? SETTING_DEFAULTS.default_country,
    default_currency: get("default_currency") ?? SETTING_DEFAULTS.default_currency,
    document_language: get("document_language") ?? SETTING_DEFAULTS.document_language,
    amount_format:    get("amount_format")    ?? SETTING_DEFAULTS.amount_format,

    low_confidence_threshold:
      get("low_confidence_threshold") !== undefined
        ? parseFloat(get("low_confidence_threshold")!)
        : SETTING_DEFAULTS.low_confidence_threshold,

    extraction_timeout_seconds:
      get("extraction_timeout_seconds") !== undefined
        ? parseInt(get("extraction_timeout_seconds")!, 10)
        : SETTING_DEFAULTS.extraction_timeout_seconds,

    auto_approve_threshold:
      get("auto_approve_threshold") === "null" || get("auto_approve_threshold") === undefined
        ? SETTING_DEFAULTS.auto_approve_threshold
        : parseFloat(get("auto_approve_threshold")!),

    flag_duplicates:
      get("flag_duplicates") !== undefined
        ? get("flag_duplicates") === "true"
        : SETTING_DEFAULTS.flag_duplicates,

    finetune_model_id:
      get("finetune_model_id") !== undefined && get("finetune_model_id") !== ""
        ? get("finetune_model_id")!
        : SETTING_DEFAULTS.finetune_model_id,

    extraction_fields: (() => {
      const raw = get("extraction_fields");
      if (!raw || raw === "null") return SETTING_DEFAULTS.extraction_fields;
      try {
        const parsed = JSON.parse(raw) as string[];
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : SETTING_DEFAULTS.extraction_fields;
      } catch {
        return SETTING_DEFAULTS.extraction_fields;
      }
    })(),

    preferred_erp: get("preferred_erp") ?? SETTING_DEFAULTS.preferred_erp,
  };
}

// ── Write ──────────────────────────────────────────────────────────────────────

/**
 * Persists settings for the given organization.
 *
 * @param partial         Key-value map of settings to update (string values only)
 * @param organizationId  Clerk org ID. Defaults to "default" (global settings).
 */
export async function saveSettings(
  partial: Partial<Record<string, string>>,
  organizationId: string = "default"
): Promise<void> {
  await Promise.all(
    Object.entries(partial)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(([key, value]) =>
        prisma.setting.upsert({
          where: { organizationId_key: { organizationId, key } },
          update: { value },
          create: { organizationId, key, value },
        })
      )
  );
}

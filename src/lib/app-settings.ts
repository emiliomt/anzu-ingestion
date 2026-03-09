/**
 * Application settings — persisted in the `settings` table as key-value pairs.
 *
 * Call getSettings() anywhere on the server to read the current configuration.
 * The settings page writes via POST /api/settings which calls saveSettings().
 *
 * All settings have sensible defaults so the app works out-of-the-box without
 * any DB rows.
 */

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
  /** GPT-4o-mini API call timeout in seconds (10–60) */
  extraction_timeout_seconds: number;
  /**
   * If every core field is ≥ this value, auto-set status to "reviewed".
   * null = disabled.
   */
  auto_approve_threshold: number | null;
  /** Whether to detect and flag duplicate invoices */
  flag_duplicates: boolean;
}

// ── Defaults (used when no DB row exists for a key) ────────────────────────────

export const SETTING_DEFAULTS: AppSettings = {
  default_country:            "CO",
  default_currency:           "COP",
  document_language:          "es",
  amount_format:              "auto",
  low_confidence_threshold:   0.85,
  extraction_timeout_seconds: 25,
  auto_approve_threshold:     null,
  flag_duplicates:            true,
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

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.setting.findMany();
  const map: Record<string, string> = Object.fromEntries(
    rows.map((r) => [r.key, r.value])
  );

  const get = (key: keyof AppSettings) => map[key] ?? undefined;

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
  };
}

// ── Write ──────────────────────────────────────────────────────────────────────

export async function saveSettings(
  partial: Partial<Record<string, string>>
): Promise<void> {
  await Promise.all(
    Object.entries(partial)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      )
  );
}

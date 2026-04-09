// Anzu Dynamics — RPA Base Connector
// Abstract contract that every ERP connector must implement.
// Connectors are instantiated by the factory (rpa/factory.ts) inside the
// BullMQ RPA worker — never in the Next.js request cycle.

import type { ErpCredentialData } from "@/lib/vault";

// ── Payload ────────────────────────────────────────────────────────────────────

/** Data the RPA connector needs to submit an invoice to an ERP */
export interface InvoiceSubmitPayload {
  invoiceId:    string;
  referenceNo:  string | null;
  vendorName:   string | null;
  totalAmount:  string | null; // e.g. "COP 1250000.00"
  currency:     string | null;
  invoiceDate:  string | null; // ISO date string
  invoiceNumber: string | null;
  lineItems: Array<{
    description: string | null;
    quantity:    number | null;
    unitPrice:   number | null;
    lineTotal:   number | null;
    category:    string | null;
  }>;
}

// ── Result ─────────────────────────────────────────────────────────────────────

export interface ConnectorResult {
  /** Whether the ERP accepted the submission */
  success: boolean;
  /** ERP-assigned document reference (e.g. "SINCO-2024-00419") */
  erpReference?: string;
  /** Human-readable status message */
  message: string;
  /** Raw ERP response for debugging (never sent to the client UI) */
  rawResponse?: unknown;
}

// ── Abstract Base ──────────────────────────────────────────────────────────────

export abstract class BaseErpConnector {
  constructor(protected readonly credentials: ErpCredentialData) {}

  /** Authenticate with the ERP (open browser session, obtain JWT, etc.) */
  abstract login(): Promise<void>;

  /** Submit the invoice payload to the ERP and return the result */
  abstract submitInvoice(payload: InvoiceSubmitPayload): Promise<ConnectorResult>;

  /** Clean up resources (close browser, invalidate session) */
  abstract logout(): Promise<void>;

  /**
   * Template method: login → submit → logout.
   * Guarantees logout is called even on failure.
   */
  async run(payload: InvoiceSubmitPayload): Promise<ConnectorResult> {
    await this.login();
    try {
      return await this.submitInvoice(payload);
    } finally {
      await this.logout().catch((err) => {
        console.error("[rpa] logout error (non-fatal):", err);
      });
    }
  }
}

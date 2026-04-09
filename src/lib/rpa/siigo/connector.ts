// Anzu Dynamics — Siigo ERP Connector (API-first)
// Siigo is a Colombian cloud ERP with a published REST API.
// Docs: https://developer.siigo.com/
//
// Auth flow: POST /auth/sign-in → JWT (expires 24h)
// Invoice creation: POST /v1/invoices (purchase receipts endpoint)
//
// Credentials required in ErpCredentialData:
//   username: Siigo API username / partner_id
//   apiKey:   Siigo access key (from Siigo developer portal)
//   baseUrl:  API base URL (e.g. "https://api.siigo.com")

import { BaseErpConnector, ConnectorResult, InvoiceSubmitPayload } from "../base-connector";
import type { ErpCredentialData } from "@/lib/vault";

const SIIGO_DEFAULT_BASE = "https://api.siigo.com";

export class SiigoConnector extends BaseErpConnector {
  private accessToken: string | null = null;
  private baseUrl: string;

  constructor(credentials: ErpCredentialData) {
    super(credentials);
    this.baseUrl = (credentials.baseUrl ?? SIIGO_DEFAULT_BASE).replace(/\/$/, "");
  }

  async login(): Promise<void> {
    const { username, apiKey } = this.credentials;
    if (!username || !apiKey) {
      throw new Error("Siigo connector requires username and apiKey in credentials");
    }

    const resp = await fetch(`${this.baseUrl}/auth/sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Partner-Id": username },
      body: JSON.stringify({ username, access_key: apiKey }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Siigo authentication failed (HTTP ${resp.status}): ${body}`);
    }

    const json = (await resp.json()) as { access_token?: string };
    if (!json.access_token) {
      throw new Error("Siigo authentication response missing access_token");
    }

    this.accessToken = json.access_token;
    console.log("[siigo-rpa] Authentication successful");
  }

  async submitInvoice(payload: InvoiceSubmitPayload): Promise<ConnectorResult> {
    if (!this.accessToken) throw new Error("Not authenticated — call login() first");

    // Build Siigo purchase document payload
    // Reference: https://developer.siigo.com/reference/createpurchaseinvoice
    const siigoPayload = {
      document: { id: 8001 }, // default purchase document type — override via extra config
      date: payload.invoiceDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      supplier: {
        identification: this.credentials.tenantCode ?? "000000000",
        branch_office: 0,
      },
      // Map extracted line items → Siigo line items format
      items: (payload.lineItems ?? []).map((li) => ({
        code: { id: 1 }, // generic product code — refine per tenant config
        description: li.description ?? "Invoice item",
        quantity: li.quantity ?? 1,
        price: li.unitPrice ?? 0,
        discount: 0,
        taxes: [],
      })),
      observations: `Anzu auto-import | ref: ${payload.referenceNo ?? "N/A"}`,
    };

    const resp = await fetch(`${this.baseUrl}/v1/purchase-invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
        "Partner-Id": this.credentials.username ?? "",
      },
      body: JSON.stringify(siigoPayload),
    });

    const json = (await resp.json()) as { id?: string; name?: string; errors?: unknown[] };

    if (!resp.ok || json.errors?.length) {
      return {
        success: false,
        message: `Siigo rejected the invoice (HTTP ${resp.status})`,
        rawResponse: json,
      };
    }

    const erpReference = json.name ?? String(json.id ?? `SIIGO-${Date.now()}`);
    console.log(`[siigo-rpa] Invoice submitted → ERP ref: ${erpReference}`);

    return {
      success: true,
      erpReference,
      message: `Invoice registered in Siigo (ref: ${erpReference})`,
      rawResponse: json,
    };
  }

  async logout(): Promise<void> {
    // Siigo JWTs expire naturally — no explicit revocation endpoint in their API.
    this.accessToken = null;
    console.log("[siigo-rpa] Session cleared");
  }
}

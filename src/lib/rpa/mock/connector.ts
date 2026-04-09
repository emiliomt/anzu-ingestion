// Anzu Dynamics — Mock ERP Connector
// Simulates a successful ERP submission for demo mode and CI testing.
// Never throws, always returns success after realistic artificial delays.

import { randomUUID } from "crypto";
import { BaseErpConnector, ConnectorResult, InvoiceSubmitPayload } from "../base-connector";
import type { ErpCredentialData } from "@/lib/vault";

export class MockErpConnector extends BaseErpConnector {
  constructor(credentials: ErpCredentialData) {
    super(credentials);
  }

  async login(): Promise<void> {
    // Simulate browser / API auth round-trip
    await delay(300);
    console.log("[mock-rpa] Logged in to mock ERP");
  }

  async submitInvoice(payload: InvoiceSubmitPayload): Promise<ConnectorResult> {
    // Simulate document creation latency
    await delay(700);

    const erpReference = `MOCK-${randomUUID().split("-")[0].toUpperCase()}`;

    console.log(
      `[mock-rpa] Invoice ${payload.invoiceId} submitted → reference: ${erpReference}`
    );

    return {
      success: true,
      erpReference,
      message: `Invoice submitted successfully to demo ERP (ref: ${erpReference})`,
      rawResponse: {
        status: "accepted",
        documentId: erpReference,
        timestamp: new Date().toISOString(),
      },
    };
  }

  async logout(): Promise<void> {
    await delay(100);
    console.log("[mock-rpa] Logged out of mock ERP");
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

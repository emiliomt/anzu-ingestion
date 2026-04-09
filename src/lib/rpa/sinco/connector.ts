// Anzu Dynamics — SINCO ERP Connector (Playwright)
// SINCO is a Colombian ERP used widely in construction & engineering firms.
// It does not expose a public REST API, so we automate the web portal
// using Playwright headless Chromium.
//
// SINCO portal URL is configurable via credential.baseUrl.
// Known selectors are based on SINCO ENTERPRISE v7.x web portal structure.
//
// This file only imports playwright dynamically to avoid bundling in Next.js.
// The connector is only instantiated inside the standalone workers/ process.

import { BaseErpConnector, ConnectorResult, InvoiceSubmitPayload } from "../base-connector";
import type { ErpCredentialData } from "@/lib/vault";

const DEFAULT_TIMEOUT = 30_000; // 30 s — ERP portals can be slow

export class SincoConnector extends BaseErpConnector {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private browser: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private page: any = null;

  constructor(credentials: ErpCredentialData) {
    super(credentials);
  }

  async login(): Promise<void> {
    // Dynamic import — playwright is a devDependency that must be installed
    // in the worker environment: npm install playwright
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { chromium } = require("playwright") as typeof import("playwright");

    const baseUrl = this.credentials.baseUrl;
    if (!baseUrl) throw new Error("SINCO baseUrl is required in credential data");

    this.browser = await chromium.launch({ headless: true });
    const context = await this.browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    });
    this.page = await context.newPage();
    this.page.setDefaultTimeout(DEFAULT_TIMEOUT);

    console.log(`[sinco-rpa] Navigating to ${baseUrl}`);
    await this.page.goto(baseUrl, { waitUntil: "networkidle" });

    // Fill login form — selectors target SINCO ENTERPRISE v7 portal
    await this.page.fill('input[name="username"], #txtUsuario, input[type="text"]:first-of-type', this.credentials.username ?? "");
    await this.page.fill('input[name="password"], #txtPassword, input[type="password"]', this.credentials.password ?? "");

    if (this.credentials.tenantCode) {
      // Some SINCO instances require an "empresa" (company) code
      const empresaField = await this.page.$('input[name="empresa"], #txtEmpresa');
      if (empresaField) {
        await empresaField.fill(this.credentials.tenantCode);
      }
    }

    await this.page.click('button[type="submit"], input[type="submit"], #btnIngresar');

    // Wait for dashboard indicator — adjust selector to match the portal version
    await this.page.waitForSelector(
      '#main-menu, .dashboard-container, [data-page="dashboard"]',
      { timeout: DEFAULT_TIMEOUT }
    );

    console.log("[sinco-rpa] Login successful");
  }

  async submitInvoice(payload: InvoiceSubmitPayload): Promise<ConnectorResult> {
    if (!this.page) throw new Error("Not logged in — call login() first");

    // Navigate to invoice entry module
    await this.page.click('a[href*="factura"], a[href*="invoice"], [data-module="facturas"]');
    await this.page.waitForSelector('form.invoice-form, #formFactura, [data-form="invoice"]');

    // Fill vendor / supplier
    const vendorField = await this.page.$('#txtProveedor, input[name="proveedor"], [placeholder*="proveedor"]');
    if (vendorField && payload.vendorName) {
      await vendorField.fill(payload.vendorName);
      // Trigger autocomplete and select first match
      await this.page.waitForTimeout(500);
      const suggestion = await this.page.$('.autocomplete-item:first-child, .dropdown-item:first-child');
      if (suggestion) await suggestion.click();
    }

    // Fill invoice number
    const invoiceNumberField = await this.page.$('#txtNumeroFactura, input[name="numeroFactura"]');
    if (invoiceNumberField && payload.invoiceNumber) {
      await invoiceNumberField.fill(payload.invoiceNumber);
    }

    // Fill invoice date
    if (payload.invoiceDate) {
      const dateField = await this.page.$('#txtFecha, input[name="fecha"], input[type="date"]');
      if (dateField) await dateField.fill(payload.invoiceDate.slice(0, 10));
    }

    // Fill total amount
    if (payload.totalAmount) {
      const totalField = await this.page.$('#txtTotal, input[name="total"], [data-field="total"]');
      const numericTotal = parseFloat(payload.totalAmount.replace(/[^0-9.]/g, ""));
      if (totalField && !isNaN(numericTotal)) {
        await totalField.fill(String(numericTotal));
      }
    }

    // Submit the form
    await this.page.click('button[type="submit"]:has-text("Guardar"), button:has-text("Registrar"), #btnGuardar');

    // Wait for confirmation / ERP reference number
    await this.page.waitForSelector(
      '.success-message, .alert-success, [data-result="success"], #lblNumeroDocumento',
      { timeout: DEFAULT_TIMEOUT }
    );

    // Extract the ERP-assigned document reference
    const erpRef = await this.page.textContent(
      '#lblNumeroDocumento, .document-reference, [data-field="documentNumber"]'
    ).catch(() => null) as string | null;

    const reference = erpRef?.trim() ?? `SINCO-${Date.now()}`;

    console.log(`[sinco-rpa] Invoice submitted → ERP ref: ${reference}`);

    return {
      success: true,
      erpReference: reference,
      message: `Invoice registered in SINCO (ref: ${reference})`,
    };
  }

  async logout(): Promise<void> {
    if (this.page) {
      try {
        await this.page.click('a[href*="logout"], #btnSalir, [data-action="logout"]');
      } catch {
        // Ignore logout navigation errors
      }
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
    console.log("[sinco-rpa] Browser closed");
  }
}

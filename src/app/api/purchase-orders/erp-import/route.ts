/**
 * POST /api/purchase-orders/erp-import
 *
 * Fetches purchase orders from an external ERP REST API and normalizes
 * the response into a PO list for preview + import.
 *
 * Body:
 *   url      - ERP API endpoint URL
 *   apiKey   - Bearer token or API key
 *   authType - "bearer" | "api_key" | "basic" (default: "bearer")
 *   dataPath - dot-path to the array inside the response (e.g. "data.items")
 *              If omitted, the root of the response is expected to be an array.
 *
 * Returns: { pos: NormalizedPO[] }
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

interface NormalizedPO {
  poNumber: string;
  vendorName: string | null;
  vendorTaxId: string | null;
  totalAmount: number | null;
  currency: string | null;
  issueDate: string | null;
  description: string | null;
  projectName: string | null;
  status: string;
}

// Field name aliases from common ERP systems (SAP, Oracle, Odoo, etc.)
const PO_NUMBER_KEYS   = ["poNumber","po_number","PO_NUMBER","order_number","orderNumber","numero_oc","numero_orden","purchaseOrderNumber","doc_num","DocNum","EBELN"];
const VENDOR_NAME_KEYS = ["vendorName","vendor_name","VENDOR_NAME","supplier_name","supplierName","proveedor","nombre_proveedor","partner_name","CardName","LIFNM"];
const VENDOR_TAX_KEYS  = ["vendorTaxId","vendor_tax_id","nit","rut","tax_id","taxId","CardCode","STCD1"];
const AMOUNT_KEYS      = ["totalAmount","total_amount","TOTAL_AMOUNT","amount","total","monto","valor_total","amount_total","DocTotal","NETWR"];
const CURRENCY_KEYS    = ["currency","CURRENCY","moneda","currency_code","currencyCode","DocCurrency","WAERS"];
const DATE_KEYS        = ["issueDate","issue_date","ISSUE_DATE","date","fecha","order_date","orderDate","DocDate","BEDAT"];
const DESC_KEYS        = ["description","DESCRIPTION","descripcion","notes","note","Comments","U_Comments","subject"];
const PROJECT_KEYS     = ["projectName","project_name","obra","proyecto","project","project_code","U_Proyecto"];

function pick<T>(obj: Record<string, T>, keys: string[]): T | undefined {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function toIsoDate(val: unknown): string | null {
  if (!val) return null;
  try {
    const d = new Date(String(val));
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch { return null; }
}

function getByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function normalizeRow(row: Record<string, unknown>): NormalizedPO | null {
  const poNumber = pick(row, PO_NUMBER_KEYS);
  if (!poNumber) return null;

  const amount = pick(row, AMOUNT_KEYS);
  return {
    poNumber: String(poNumber),
    vendorName: pick(row, VENDOR_NAME_KEYS) ? String(pick(row, VENDOR_NAME_KEYS)) : null,
    vendorTaxId: pick(row, VENDOR_TAX_KEYS) ? String(pick(row, VENDOR_TAX_KEYS)) : null,
    totalAmount: amount != null ? Number(amount) : null,
    currency: pick(row, CURRENCY_KEYS) ? String(pick(row, CURRENCY_KEYS)) : null,
    issueDate: toIsoDate(pick(row, DATE_KEYS)),
    description: pick(row, DESC_KEYS) ? String(pick(row, DESC_KEYS)) : null,
    projectName: pick(row, PROJECT_KEYS) ? String(pick(row, PROJECT_KEYS)) : null,
    status: "open",
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    url: string;
    apiKey?: string;
    authType?: "bearer" | "api_key" | "basic";
    dataPath?: string;
  };

  if (!body.url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Accept": "application/json",
    "Content-Type": "application/json",
  };

  if (body.apiKey) {
    const authType = body.authType ?? "bearer";
    if (authType === "bearer") {
      headers["Authorization"] = `Bearer ${body.apiKey}`;
    } else if (authType === "api_key") {
      headers["X-API-Key"] = body.apiKey;
    } else if (authType === "basic") {
      headers["Authorization"] = `Basic ${Buffer.from(body.apiKey).toString("base64")}`;
    }
  }

  let erpResponse: Response;
  try {
    erpResponse = await fetch(body.url, { headers, signal: AbortSignal.timeout(15000) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to reach ERP: ${msg}` }, { status: 502 });
  }

  if (!erpResponse.ok) {
    return NextResponse.json(
      { error: `ERP returned HTTP ${erpResponse.status}: ${erpResponse.statusText}` },
      { status: 502 }
    );
  }

  let data: unknown;
  try {
    data = await erpResponse.json();
  } catch {
    return NextResponse.json({ error: "ERP response is not valid JSON" }, { status: 422 });
  }

  const array = getByPath(data, body.dataPath ?? "");
  if (!Array.isArray(array)) {
    return NextResponse.json(
      { error: `Expected an array at path "${body.dataPath ?? "(root)"}". Got: ${typeof array}` },
      { status: 422 }
    );
  }

  const pos: NormalizedPO[] = [];
  for (const row of array) {
    if (row && typeof row === "object") {
      const normalized = normalizeRow(row as Record<string, unknown>);
      if (normalized) pos.push(normalized);
    }
  }

  return NextResponse.json({ pos, total: array.length, imported: pos.length });
}

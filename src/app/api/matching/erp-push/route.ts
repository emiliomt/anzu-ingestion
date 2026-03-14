import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildHeaders(apiKey: string, authType: string): Record<string, string> {
  const h: Record<string, string> = {};
  if (authType === "bearer")  h["Authorization"] = `Bearer ${apiKey}`;
  if (authType === "api_key") h["X-API-Key"] = apiKey;
  if (authType === "basic")   h["Authorization"] = `Basic ${Buffer.from(apiKey).toString("base64")}`;
  return h;
}

// ── POST /api/matching/erp-push ───────────────────────────────────────────────
// Body: { url, apiKey, authType, format }
//   format = "json"  → POST match data as application/json
//   format = "xlsx"  → POST match Excel as multipart/form-data (field: "file")
export async function POST(request: NextRequest) {
  let body: { url?: string; apiKey?: string; authType?: string; format?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { url, apiKey = "", authType = "bearer", format = "json" } = body;
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

  // ── Fetch confirmed matches ──────────────────────────────────────────────
  const matches = await prisma.invoiceMatch.findMany({
    where: { isConfirmed: true },
    include: {
      invoice: { include: { extractedData: true } },
      project:       true,
      purchaseOrder: true,
      cajaChica:     true,
    },
    orderBy: { confirmedAt: "desc" },
  });

  const rows = matches.map((m) => {
    const fields: Record<string, string> = {};
    for (const f of m.invoice.extractedData) {
      fields[f.fieldName] = f.fieldValue ?? "";
    }
    return {
      referenceNo:     m.invoice.referenceNo,
      invoiceNumber:   fields["invoice_number"] ?? "",
      issueDate:       fields["issue_date"]     ?? "",
      vendorName:      fields["vendor_name"]    ?? "",
      vendorTaxId:     fields["vendor_tax_id"]  ?? "",
      totalAmount:     fields["total"]          ?? "",
      currency:        fields["currency"]       ?? "",
      matchType:       m.matchType,
      poNumber:        m.purchaseOrder?.poNumber ?? "",
      projectName:     m.project?.name           ?? "",
      projectCode:     m.project?.code           ?? "",
      cajaChicaFund:   m.cajaChica?.name         ?? "",
      confidencePct:   m.confidence != null ? Math.round(m.confidence * 100) : null,
      matchedBy:       m.matchedBy   ?? "",
      confirmedBy:     m.confirmedBy ?? "",
      confirmedAt:     m.confirmedAt ? new Date(m.confirmedAt).toISOString().slice(0, 10) : "",
    };
  });

  const extraHeaders = buildHeaders(apiKey, authType);

  // ── JSON push ────────────────────────────────────────────────────────────
  if (format === "json") {
    let erpRes: Response;
    try {
      erpRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...extraHeaders },
        body: JSON.stringify({ matches: rows, exportedAt: new Date().toISOString() }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      return NextResponse.json({ error: `Failed to reach ERP: ${msg}` }, { status: 502 });
    }
    const text = await erpRes.text();
    return NextResponse.json({
      erpStatus: erpRes.status,
      erpBody: text.slice(0, 2000),
      recordsSent: rows.length,
    });
  }

  // ── XLSX push ────────────────────────────────────────────────────────────
  if (format === "xlsx") {
    const headers = [
      "Reference No", "Invoice Number", "Issue Date", "Vendor Name",
      "Vendor Tax ID (NIT)", "Total Amount", "Currency", "Match Type",
      "PO Number", "Project Name", "Project Code", "Caja Chica Fund",
      "Confidence %", "Matched By", "Confirmed By", "Confirmed At",
    ];
    const sheetRows = rows.map((r) => [
      r.referenceNo, r.invoiceNumber, r.issueDate, r.vendorName,
      r.vendorTaxId, r.totalAmount, r.currency, r.matchType,
      r.poNumber, r.projectName, r.projectCode, r.cajaChicaFund,
      r.confidencePct != null ? `${r.confidencePct}%` : "",
      r.matchedBy, r.confirmedBy, r.confirmedAt,
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sheetRows]);
    ws["!cols"] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ERP Export");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const date = new Date().toISOString().slice(0, 10);
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `anzu-matcher-export-${date}.xlsx`,
    );

    let erpRes: Response;
    try {
      erpRes = await fetch(url, {
        method: "POST",
        headers: extraHeaders,
        body: formData,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      return NextResponse.json({ error: `Failed to reach ERP: ${msg}` }, { status: 502 });
    }
    const text = await erpRes.text();
    return NextResponse.json({
      erpStatus: erpRes.status,
      erpBody: text.slice(0, 2000),
      recordsSent: rows.length,
    });
  }

  return NextResponse.json({ error: "format must be json or xlsx" }, { status: 400 });
}

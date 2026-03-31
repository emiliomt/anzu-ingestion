import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ── Anzu internal field keys exposed for ERP column mapping ────────────────────

const ANZU_FIELD_LABELS: Record<string, string> = {
  invoice_number:   "Invoice Number",
  vendor_name:      "Vendor Name",
  vendor_nit:       "Vendor NIT / Tax ID",
  invoice_date:     "Invoice Date",
  due_date:         "Due Date",
  total_amount:     "Total Amount",
  tax_amount:       "Tax Amount (IVA)",
  tax_base:         "Tax Base (Subtotal)",
  line_description: "Line Item Description",
  account_code:     "Account Code",
  debit_amount:     "Debit Amount",
  credit_amount:    "Credit Amount",
  cost_center:      "Cost Center",
  document_type:    "Document Type",
  consecutive:      "Consecutive",
  reference:        "Reference No",
  segment:          "Segment",
};

// ── Resolve an Anzu field for a given invoice + optional line item ─────────────

interface InvoiceWithData {
  referenceNo: string;
  extractedData: { fieldName: string; value: string | null }[];
  lineItems: {
    description: string | null;
    lineTotal: number | null;
    quantity: number | null;
    unitPrice: number | null;
  }[];
}

function resolveAnzuField(
  invoice: InvoiceWithData,
  lineItem: InvoiceWithData["lineItems"][number] | null,
  field: string
): string | number {
  const fields: Record<string, string> = {};
  for (const f of invoice.extractedData) {
    fields[f.fieldName] = f.value ?? "";
  }

  const toNum = (v: string | undefined): number => {
    const n = parseFloat(v ?? "");
    return isNaN(n) ? 0 : n;
  };

  switch (field) {
    case "invoice_number":   return fields["invoice_number"]  ?? "";
    case "vendor_name":      return fields["vendor_name"]     ?? "";
    case "vendor_nit":       return fields["vendor_tax_id"]   ?? "";
    case "invoice_date":     return fields["issue_date"]      ?? "";
    case "due_date":         return fields["due_date"]        ?? "";
    case "total_amount":     return toNum(fields["total"]);
    case "tax_amount":       return toNum(fields["tax"]);
    case "tax_base":         return toNum(fields["subtotal"]);
    case "line_description": return lineItem?.description     ?? fields["concept"] ?? "";
    case "account_code":     return "";
    case "debit_amount":     return lineItem?.lineTotal != null ? lineItem.lineTotal : toNum(fields["total"]);
    case "credit_amount":    return 0;
    case "cost_center":      return "";
    case "document_type":    return "FC";
    case "consecutive":      return fields["invoice_number"]  ?? "";
    case "reference":        return invoice.referenceNo;
    case "segment":          return "";
    default:                 return "";
  }
}

// ── SINCO ERP preset ───────────────────────────────────────────────────────────

const SINCO_HEADERS = [
  "dTipoDocumento",
  "dConsecutivo",
  "dTercero",
  "dDescripcion",
  "dFecha",
  "dVencimiento",
  "dReferencia",
  "mCuenta",
  "mDebito",
  "mCredito",
  "mDescripcion",
  "mNit",
  "mBase",
  "mCentroC",
  "mSegmento",
];

function buildSincoRow(
  invoice: InvoiceWithData,
  lineItem: InvoiceWithData["lineItems"][number] | null
): (string | number)[] {
  const fields: Record<string, string> = {};
  for (const f of invoice.extractedData) {
    fields[f.fieldName] = f.value ?? "";
  }

  const toNum = (v: string | undefined): number => {
    const n = parseFloat(v ?? "");
    return isNaN(n) ? 0 : n;
  };

  return [
    "FC",                                                    // dTipoDocumento
    fields["invoice_number"]  ?? "",                         // dConsecutivo
    fields["vendor_tax_id"]   ?? "",                         // dTercero
    fields["vendor_name"]     ?? "",                         // dDescripcion
    fields["issue_date"]      ?? "",                         // dFecha
    fields["due_date"]        ?? "",                         // dVencimiento
    invoice.referenceNo,                                     // dReferencia
    "",                                                      // mCuenta
    lineItem?.lineTotal != null
      ? lineItem.lineTotal
      : toNum(fields["total"]),                              // mDebito
    0,                                                       // mCredito
    lineItem?.description ?? fields["concept"] ?? "",        // mDescripcion
    fields["vendor_tax_id"]   ?? "",                         // mNit
    toNum(fields["subtotal"]),                               // mBase
    "",                                                      // mCentroC
    "",                                                      // mSegmento
  ];
}

// ── Format timestamp for filename ─────────────────────────────────────────────

function fileTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      invoiceIds: string[];
      profileId: string; // "sinco" | uuid
    };

    if (!Array.isArray(body.invoiceIds) || body.invoiceIds.length === 0) {
      return NextResponse.json({ error: "invoiceIds must be a non-empty array" }, { status: 400 });
    }

    // Load invoices with extracted data and line items
    const invoices = await prisma.invoice.findMany({
      where: { id: { in: body.invoiceIds } },
      include: {
        extractedData: { select: { fieldName: true, value: true } },
        lineItems: {
          select: { description: true, lineTotal: true, quantity: true, unitPrice: true },
        },
      },
    });

    if (invoices.length === 0) {
      return NextResponse.json({ error: "No invoices found for given IDs" }, { status: 404 });
    }

    // ── SINCO preset ──────────────────────────────────────────────────────────
    if (body.profileId === "sinco") {
      const dataRows: (string | number)[][] = [];

      for (const inv of invoices) {
        if (inv.lineItems.length > 0) {
          for (const li of inv.lineItems) {
            dataRows.push(buildSincoRow(inv, li));
          }
        } else {
          dataRows.push(buildSincoRow(inv, null));
        }
      }

      const ws = XLSX.utils.aoa_to_sheet([SINCO_HEADERS, ...dataRows]);

      // Column widths
      ws["!cols"] = SINCO_HEADERS.map(() => ({ wch: 16 }));
      ws["!freeze"] = { xSplit: 0, ySplit: 1 };

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "CONTABILIDAD");

      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      const filename = `SINCO_export_${fileTimestamp()}.xlsx`;

      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ── Custom profile ────────────────────────────────────────────────────────
    const profile = await prisma.erpExportProfile.findUnique({
      where: { id: body.profileId },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const columnMapping = JSON.parse(profile.columnMapping) as {
      header: string;
      anzuField: string | null;
    }[];

    const headers = columnMapping.map((c) => c.header);
    const dataRows: (string | number)[][] = [];

    for (const inv of invoices) {
      if (inv.lineItems.length > 0) {
        for (const li of inv.lineItems) {
          dataRows.push(
            columnMapping.map((col) =>
              col.anzuField ? resolveAnzuField(inv, li, col.anzuField) : ""
            )
          );
        }
      } else {
        dataRows.push(
          columnMapping.map((col) =>
            col.anzuField ? resolveAnzuField(inv, null, col.anzuField) : ""
          )
        );
      }
    }

    const safeProfileName = profile.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    if (profile.outputFormat === "csv") {
      const escapeCsv = (v: string | number) => {
        const s = String(v);
        return `"${s.replace(/"/g, '""')}"`;
      };
      const csvLines = [
        headers.map(escapeCsv).join(","),
        ...dataRows.map((row) => row.map(escapeCsv).join(",")),
      ];
      const csv = csvLines.join("\n");
      const filename = `ERP_${safeProfileName}_${date}.csv`;

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Default: XLSX
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    ws["!cols"] = headers.map(() => ({ wch: 18 }));
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, profile.name.slice(0, 31));

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `ERP_${safeProfileName}_${date}.xlsx`;

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

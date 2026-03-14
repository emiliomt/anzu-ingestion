import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") ?? "confirmed"; // "confirmed" | "all"

  try {
    const matches = await prisma.invoiceMatch.findMany({
      where: filter === "all"
        ? {}
        : { isConfirmed: true },
      include: {
        invoice: {
          include: { extractedData: true },
        },
        project:       true,
        purchaseOrder: true,
        cajaChica:     true,
      },
      orderBy: [{ isConfirmed: "desc" }, { confirmedAt: "desc" }, { matchedAt: "desc" }],
    });

    // ── Build rows ────────────────────────────────────────────────────────────
    const headers = [
      "Reference No",
      "Invoice Number",
      "Issue Date",
      "Vendor Name",
      "Vendor Tax ID (NIT)",
      "Total Amount",
      "Currency",
      "Match Type",
      "PO Number",
      "Project Name",
      "Project Code",
      "Caja Chica Fund",
      "Confidence %",
      "Matched By",
      "Confirmed By",
      "Confirmed At",
      "Status",
    ];

    const rows = matches.map((m) => {
      // Map extracted fields by name for quick lookup
      const fields: Record<string, string> = {};
      for (const f of m.invoice.extractedData) {
        fields[f.fieldName] = f.fieldValue ?? "";
      }

      const matchType = m.matchType; // purchase_order | project | caja_chica
      const matchTypeLabel =
        matchType === "purchase_order" ? "Purchase Order"
        : matchType === "project"       ? "Project"
        : matchType === "caja_chica"    ? "Caja Chica"
        : matchType;

      const confidence = m.confidence != null
        ? `${Math.round(m.confidence * 100)}%`
        : "";

      const confirmedAt = m.confirmedAt
        ? new Date(m.confirmedAt).toISOString().slice(0, 10)
        : "";

      const status = m.isConfirmed ? "Confirmed" : "Awaiting Review";

      return [
        m.invoice.referenceNo,
        fields["invoice_number"] ?? "",
        fields["issue_date"]     ?? "",
        fields["vendor_name"]    ?? "",
        fields["vendor_tax_id"]  ?? "",
        fields["total"]          ?? "",
        fields["currency"]       ?? "",
        matchTypeLabel,
        m.purchaseOrder?.poNumber ?? "",
        m.project?.name           ?? "",
        m.project?.code           ?? "",
        m.cajaChica?.name         ?? "",
        confidence,
        m.matchedBy   ?? "",
        m.confirmedBy ?? "",
        confirmedAt,
        status,
      ];
    });

    // ── Build workbook ────────────────────────────────────────────────────────
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // Column widths (characters)
    ws["!cols"] = [
      { wch: 18 }, // Reference No
      { wch: 16 }, // Invoice Number
      { wch: 12 }, // Issue Date
      { wch: 28 }, // Vendor Name
      { wch: 18 }, // Vendor Tax ID
      { wch: 14 }, // Total Amount
      { wch: 10 }, // Currency
      { wch: 16 }, // Match Type
      { wch: 16 }, // PO Number
      { wch: 26 }, // Project Name
      { wch: 12 }, // Project Code
      { wch: 20 }, // Caja Chica Fund
      { wch: 12 }, // Confidence %
      { wch: 14 }, // Matched By
      { wch: 14 }, // Confirmed By
      { wch: 14 }, // Confirmed At
      { wch: 16 }, // Status
    ];

    // Freeze top row
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ERP Export");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(buf, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="anzu-matcher-export-${date}.xlsx"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

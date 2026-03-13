import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET() {
  const headers = [
    "Project Name",
    "Code",
    "Address",
    "City",
    "VAT",
    "Supervisor",
    "Status",
    "Budget",
    "Currency",
  ];

  const example = [
    "URBANISMO PH - PUENTE LA CAROLINA",
    "PROJ-001",
    "Diag 32 N° 80-918 La Providencia",
    "Cartagena",
    "900123456-7",
    "Yina Orozco",
    "active",
    "500000000",
    "COP",
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws["!cols"] = headers.map(() => ({ wch: 28 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Projects");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="projects_template.xlsx"',
    },
  });
}

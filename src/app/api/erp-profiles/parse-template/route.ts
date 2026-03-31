import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

/**
 * POST /api/erp-profiles/parse-template
 *
 * Accepts a multipart/form-data upload with a single `file` field (.csv or .xlsx).
 * Reads only the first row and returns the detected column headers.
 *
 * Response: { headers: string[], detectedFormat: "csv" | "xlsx" }
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const blob = file as File;
    const fileName = blob.name.toLowerCase();
    const isXlsx = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const isCsv = fileName.endsWith(".csv");

    if (!isXlsx && !isCsv) {
      return NextResponse.json(
        { error: "Only .csv and .xlsx files are supported" },
        { status: 400 }
      );
    }

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse with SheetJS — works for both CSV and XLSX
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      sheetRows: 1, // only read the first row
    });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // aoa_to_sheet returns rows; we only asked for 1 row
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });

    if (!rows.length || !Array.isArray(rows[0])) {
      return NextResponse.json({ error: "Could not read headers from file" }, { status: 422 });
    }

    const headers = (rows[0] as string[])
      .map((h) => String(h ?? "").trim())
      .filter(Boolean);

    if (headers.length === 0) {
      return NextResponse.json({ error: "No headers found in first row" }, { status: 422 });
    }

    return NextResponse.json({
      headers,
      detectedFormat: isXlsx ? "xlsx" : "csv",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

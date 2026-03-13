import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

interface ProjectRow {
  "Project Name"?: string;
  "Code"?: string;
  "Address"?: string;
  "City"?: string;
  "VAT"?: string;
  "Supervisor"?: string;
  "Status"?: string;
  "Budget"?: string | number;
  "Currency"?: string;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<ProjectRow>(ws);

  const errors: string[] = [];
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row["Project Name"] ?? "").trim();

    if (!name) {
      errors.push(`Row ${i + 2}: "Project Name" is required`);
      continue;
    }

    const code = String(row["Code"] ?? "").trim() || null;
    const status = String(row["Status"] ?? "active").trim().toLowerCase();
    const validStatuses = ["active", "on_hold", "closed"];

    try {
      await prisma.project.create({
        data: {
          name,
          code: code || null,
          address: String(row["Address"] ?? "").trim() || null,
          city: String(row["City"] ?? "").trim() || null,
          vat: String(row["VAT"] ?? "").trim() || null,
          supervisor: String(row["Supervisor"] ?? "").trim() || null,
          budget: row["Budget"] ? Number(row["Budget"]) : null,
          currency: String(row["Currency"] ?? "COP").trim() || "COP",
          status: validStatuses.includes(status) ? status : "active",
        },
      });
      created++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Unique constraint") && msg.includes("code")) {
        errors.push(`Row ${i + 2}: Code "${code}" already exists — skipped`);
      } else {
        errors.push(`Row ${i + 2}: ${msg}`);
      }
    }
  }

  return NextResponse.json({ created, errors });
}

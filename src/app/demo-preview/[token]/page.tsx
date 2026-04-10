// Anzu Dynamics — Shareable Demo Preview Page
// No login required. Token is a signed JWT (DEMO_JWT_SECRET, 30-min TTL).
// Shows a read-only view of seeded demo invoices + VAT recovery metrics.

import { jwtVerify } from "jose";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface DemoInvoiceRow {
  id: string;
  referenceNo: string;
  status: string;
  flags: string;
  submittedAt: Date;
  processedAt: Date | null;
  vendor: { name: string } | null;
  extractedData: Array<{ fieldName: string; value: string | null; confidence: number | null }>;
}

async function getDemoData(token: string) {
  const secret = process.env.DEMO_JWT_SECRET;
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const orgId = payload.orgId as string;
    const sessionId = payload.sessionId as string;

    // Verify session still exists and is not expired
    const session = await prisma.demoSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.expiresAt < new Date()) return null;

    const invoices = await prisma.invoice.findMany({
      where: { organizationId: orgId, channel: "demo" },
      orderBy: { submittedAt: "desc" },
      include: {
        vendor: { select: { name: true } },
        extractedData: {
          where: { fieldName: { in: ["total", "tax", "currency", "invoice_number", "issue_date"] } },
          select: { fieldName: true, value: true, confidence: true },
        },
      },
    });

    return { invoices };
  } catch {
    return null;
  }
}

function getField(row: DemoInvoiceRow, name: string) {
  return row.extractedData.find((f) => f.fieldName === name)?.value ?? null;
}

function statusColor(status: string) {
  switch (status) {
    case "reviewed":  return { bg: "#DCFCE7", text: "#166534" };
    case "extracted": return { bg: "#DBEAFE", text: "#1E40AF" };
    case "error":     return { bg: "#FEE2E2", text: "#991B1B" };
    default:          return { bg: "#F3F4F6", text: "#374151" };
  }
}

export default async function DemoPreviewPage({
  params,
}: {
  params: { token: string };
}) {
  const data = await getDemoData(params.token);
  if (!data) notFound();

  const { invoices } = data;

  // Compute VAT metrics
  let totalTax = 0;
  let totalAmount = 0;
  let reviewedCount = 0;

  for (const inv of invoices) {
    const tax = parseFloat(getField(inv as DemoInvoiceRow, "tax") ?? "0") || 0;
    const total = parseFloat(getField(inv as DemoInvoiceRow, "total") ?? "0") || 0;
    totalTax += tax;
    totalAmount += total;
    if (inv.status === "reviewed") reviewedCount++;
  }

  const effectiveRate = totalAmount > 0 ? (totalTax / totalAmount) * 100 : 0;

  function fmt(n: number) {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
  }

  return (
    <div className="min-h-screen" style={{ background: "#F8FAFC", fontFamily: "var(--font-sans, system-ui)" }}>
      {/* Header */}
      <div style={{ background: "#0F172A", color: "white", padding: "16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#F97316,#EA580C)",
          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14
        }}>A</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Anzu Dynamics — Live Demo</div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>Read-only preview · Link expires in 30 min</div>
        </div>
        <div style={{ marginLeft: "auto", background: "#1E293B", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#94A3B8" }}>
          Demo Data
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
          {[
            { label: "Total invoices",    value: String(invoices.length) },
            { label: "Reviewed",          value: String(reviewedCount) },
            { label: "Total VAT",         value: fmt(totalTax) },
            { label: "Effective VAT rate",value: `${effectiveRate.toFixed(1)}%` },
          ].map((s) => (
            <div key={s.label} style={{ background: "white", borderRadius: 10, padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
              <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#0F172A" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Invoice table */}
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.07)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: "#0F172A" }}>Invoice Processing Log</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  {["Reference", "Vendor", "Invoice #", "Date", "Total", "Tax", "Status"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 16px", color: "#64748B", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, idx) => {
                  const row = inv as DemoInvoiceRow;
                  const { bg, text } = statusColor(inv.status);
                  return (
                    <tr key={inv.id} style={{ borderTop: "1px solid #F1F5F9", background: idx % 2 === 0 ? "white" : "#FAFAFA" }}>
                      <td style={{ padding: "10px 16px", fontFamily: "monospace", color: "#0F172A", fontSize: 12 }}>{inv.referenceNo}</td>
                      <td style={{ padding: "10px 16px", color: "#374151", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.vendor?.name ?? "—"}</td>
                      <td style={{ padding: "10px 16px", color: "#64748B", fontFamily: "monospace", fontSize: 12 }}>{getField(row, "invoice_number") ?? "—"}</td>
                      <td style={{ padding: "10px 16px", color: "#64748B" }}>{getField(row, "issue_date") ?? inv.submittedAt.toISOString().slice(0, 10)}</td>
                      <td style={{ padding: "10px 16px", color: "#0F172A", fontWeight: 500 }}>{getField(row, "total") ? fmt(parseFloat(getField(row, "total")!)) : "—"}</td>
                      <td style={{ padding: "10px 16px", color: "#64748B" }}>{getField(row, "tax") ? fmt(parseFloat(getField(row, "tax")!)) : "—"}</td>
                      <td style={{ padding: "10px 16px" }}>
                        <span style={{ background: bg, color: text, padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 32, color: "#94A3B8", fontSize: 12 }}>
          This is a read-only preview. All data is synthetic demo data.
          <br />
          Powered by <strong style={{ color: "#F97316" }}>Anzu Dynamics</strong> — Invoice Automation for Latin America.
        </div>
      </div>
    </div>
  );
}

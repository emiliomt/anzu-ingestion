"use client";

// Anzu Dynamics — VAT Recovery Dashboard
// Aggregates the extracted "tax" field across all invoices for the current org.
// Shows: total VAT tracked, monthly trend, per-invoice breakdown.

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Receipt, TrendingUp, Loader2, RefreshCw,
  FileText, Calendar, ChevronDown, ChevronUp,
} from "lucide-react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────────

interface VatInvoice {
  id: string;
  referenceNo: string;
  fileName: string;
  status: string;
  currency: string | null;
  taxAmount: number | null;
  totalAmount: number | null;
  vendorName: string | null;
  issueDate: string | null;
  processedAt: string | null;
}

interface VatSummary {
  invoices: VatInvoice[];
  totalTax: number;
  totalAmount: number;
  effectiveRate: number;
  byCurrency: Record<string, { tax: number; total: number; count: number }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number, currency = "COP") {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function monthOf(dateStr: string | null): string {
  if (!dateStr) return "Unknown";
  const d = new Date(dateStr);
  return d.toLocaleString("es-CO", { year: "numeric", month: "short" });
}

// ── Subcomponents ──────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `${color}15` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-none mb-1">{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function VatPage() {
  const [summary, setSummary] = useState<VatSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Re-use the invoices API — request extracted fields
      const res = await fetch("/api/invoices?limit=500&fields=tax,total,currency,vendor_name,issue_date");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        invoices: Array<{
          id: string;
          referenceNo: string;
          fileName: string;
          status: string;
          processedAt: string | null;
          extractedData: Array<{ fieldName: string; value: string | null }>;
        }>;
      };

      let totalTax = 0;
      let totalAmount = 0;
      const byCurrency: Record<string, { tax: number; total: number; count: number }> = {};

      const invoices: VatInvoice[] = (data.invoices ?? []).map((inv) => {
        const field = (name: string) =>
          inv.extractedData?.find((f) => f.fieldName === name)?.value ?? null;

        const rawTax = field("tax");
        const rawTotal = field("total");
        const currency = field("currency") ?? "COP";

        const taxAmount   = rawTax   ? parseFloat(rawTax.replace(/[^0-9.]/g, ""))   : null;
        const totalAmount = rawTotal ? parseFloat(rawTotal.replace(/[^0-9.]/g, "")) : null;

        if (taxAmount && !isNaN(taxAmount)) {
          totalTax += taxAmount;
          const cur = byCurrency[currency] ?? { tax: 0, total: 0, count: 0 };
          cur.tax += taxAmount;
          if (totalAmount && !isNaN(totalAmount)) cur.total += totalAmount;
          cur.count += 1;
          byCurrency[currency] = cur;
        }
        if (totalAmount && !isNaN(totalAmount)) {
          totalAmount;
        }

        return {
          id: inv.id,
          referenceNo: inv.referenceNo,
          fileName: inv.fileName,
          status: inv.status,
          currency,
          taxAmount: taxAmount && !isNaN(taxAmount) ? taxAmount : null,
          totalAmount: totalAmount && !isNaN(totalAmount) ? totalAmount : null,
          vendorName: field("vendor_name"),
          issueDate: field("issue_date"),
          processedAt: inv.processedAt,
        };
      });

      // Compute total amount from currency buckets
      for (const c of Object.values(byCurrency)) totalAmount += c.total;

      setSummary({
        invoices: invoices.filter((i) => i.taxAmount !== null),
        totalTax,
        totalAmount,
        effectiveRate: totalAmount > 0 ? (totalTax / totalAmount) * 100 : 0,
        byCurrency,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load VAT data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Group by month for the trend view
  const byMonth: Record<string, { tax: number; count: number }> = {};
  if (summary) {
    for (const inv of summary.invoices) {
      const month = monthOf(inv.issueDate ?? inv.processedAt);
      const entry = byMonth[month] ?? { tax: 0, count: 0 };
      entry.tax += inv.taxAmount ?? 0;
      entry.count += 1;
      byMonth[month] = entry;
    }
  }
  const monthEntries = Object.entries(byMonth).slice(-6); // last 6 months
  const maxMonthTax = Math.max(...monthEntries.map(([, v]) => v.tax), 1);

  const displayedInvoices = expanded
    ? (summary?.invoices ?? [])
    : (summary?.invoices ?? []).slice(0, 10);

  const primaryCurrency = summary
    ? Object.entries(summary.byCurrency).sort((a, b) => b[1].tax - a[1].tax)[0]?.[0] ?? "COP"
    : "COP";

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">VAT Recovery</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Aggregate tax tracking across all processed invoices
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          className="gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Total VAT Tracked"
          value={summary ? fmt(summary.totalTax, primaryCurrency) : "—"}
          sub={`${summary?.invoices.length ?? 0} invoices with tax`}
          icon={Receipt}
          color="#F97316"
        />
        <StatCard
          label="Effective Tax Rate"
          value={summary ? `${summary.effectiveRate.toFixed(1)}%` : "—"}
          sub="Tax / Gross amount"
          icon={TrendingUp}
          color="#8B5CF6"
        />
        <StatCard
          label="Gross Amount (w/ tax)"
          value={summary ? fmt(summary.totalAmount, primaryCurrency) : "—"}
          sub="Sum of all invoice totals"
          icon={FileText}
          color="#10B981"
        />
      </div>

      {/* Currency breakdown */}
      {summary && Object.keys(summary.byCurrency).length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">By Currency</h2>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(summary.byCurrency).map(([cur, data]) => (
              <div key={cur} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-xs font-semibold text-gray-900">{cur}</p>
                  <p className="text-xs text-gray-500">{data.count} invoices</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{fmt(data.tax, cur)}</p>
                  <p className="text-xs text-gray-400">VAT</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly trend */}
      {monthEntries.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">Monthly VAT Trend</h2>
          </div>
          <div className="flex items-end gap-2 h-28">
            {monthEntries.map(([month, data]) => {
              const pct = (data.tax / maxMonthTax) * 100;
              return (
                <div key={month} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-lg transition-all"
                    style={{
                      height: `${Math.max(pct, 4)}%`,
                      background: "linear-gradient(180deg, #F97316, #EA580C)",
                      opacity: 0.85,
                    }}
                    title={`${month}: ${fmt(data.tax, primaryCurrency)}`}
                  />
                  <p className="text-[10px] text-gray-500 text-center leading-tight">{month}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invoice table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Invoice Detail</h2>
          {summary && summary.invoices.length > 10 && (
            <span className="text-xs text-gray-500">
              {summary.invoices.length} invoices with VAT
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        ) : !summary || summary.invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Receipt className="w-8 h-8 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-600 mb-1">No VAT data yet</p>
            <p className="text-xs text-gray-400 max-w-xs">
              VAT amounts will appear here once invoices are processed by the AI
              extraction pipeline.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                    {["Vendor", "Invoice", "Issue Date", "Currency", "VAT Amount", "Total", "Status"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedInvoices.map((inv, i) => (
                    <tr
                      key={inv.id}
                      style={{ borderBottom: i < displayedInvoices.length - 1 ? "1px solid #F8FAFC" : "none" }}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-gray-900 max-w-[140px] truncate">
                          {inv.vendorName ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/invoices/${inv.id}`}
                          className="font-mono text-xs text-orange-600 hover:underline"
                        >
                          {inv.referenceNo}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600">
                          {inv.issueDate ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">
                          {inv.currency ?? "—"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-gray-900">
                          {inv.taxAmount !== null
                            ? fmt(inv.taxAmount, inv.currency ?? "COP")
                            : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-600">
                          {inv.totalAmount !== null
                            ? fmt(inv.totalAmount, inv.currency ?? "COP")
                            : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={inv.status === "reviewed" ? "default" : "outline"}
                          className="text-xs capitalize"
                        >
                          {inv.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {summary.invoices.length > 10 && (
              <div className="px-4 py-3 border-t border-gray-100 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded((e) => !e)}
                  className="gap-2 text-xs text-gray-600"
                >
                  {expanded ? (
                    <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
                  ) : (
                    <><ChevronDown className="w-3.5 h-3.5" /> Show all {summary.invoices.length} invoices</>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

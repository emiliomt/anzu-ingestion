"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Download, RefreshCw, TrendingDown, FileText, FolderOpen, Coins } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface CategoryRow {
  category: string;
  accountCode: string;
  accountLabel: string;
  total: number;
  lineItemCount: number;
  invoiceCount: number;
}

interface ProjectRow {
  projectId: string;
  projectName: string;
  total: number;
  invoiceCount: number;
  byCategory: Record<string, number>;
}

interface MonthRow {
  month: string;
  total: number;
  byCategory: Record<string, number>;
}

interface Summary {
  period: string;
  totals: { regular: number; cajaChica: number; grand: number };
  byCategory: CategoryRow[];
  byProject: ProjectRow[];
  byMonth: MonthRow[];
  invoiceCount: number;
  matchCount: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const PERIODS = [
  { value: "month",   label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "ytd",     label: "Year to Date" },
  { value: "all",     label: "All Time" },
];

function fmt(amount: number, currency = "COP") {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function periodLabel(period: string) {
  const now = new Date();
  if (period === "month") return now.toLocaleString("default", { month: "long", year: "numeric" });
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `Q${q} ${now.getFullYear()}`;
  }
  if (period === "ytd") return `Jan – ${now.toLocaleString("default", { month: "short" })} ${now.getFullYear()}`;
  return "All Time";
}

function MonthBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-orange-400 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PreaccountingPage() {
  const [period, setPeriod] = useState("ytd");
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/preaccounting/summary?period=${period}`);
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const maxMonth = data ? Math.max(...data.byMonth.map((m) => m.total), 1) : 1;

  // Separate regular and caja-chica categories for the P&L table
  // We show one combined table with both columns
  const allCats = data?.byCategory ?? [];

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold tracking-widest text-orange-500 uppercase mb-1">
            Pre-Accounting
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Preliminary P&amp;L — Expenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Approved &amp; matched invoices · {data ? periodLabel(period) : "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/preaccounting/export?period=${period}`}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </a>
          <button
            onClick={load}
            className="p-2 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Period tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-8">
        {PERIODS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setPeriod(value)}
            className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${
              period === value
                ? "bg-white shadow text-orange-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-5">
              <div className="flex items-center gap-2 text-orange-500 mb-2">
                <TrendingDown className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Total Expenses</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{fmt(data.totals.grand)}</div>
              <div className="text-xs text-gray-500 mt-0.5">{periodLabel(period)}</div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
              <div className="flex items-center gap-2 text-blue-500 mb-2">
                <FileText className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Invoices</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{data.invoiceCount}</div>
              <div className="text-xs text-gray-500 mt-0.5">approved &amp; matched</div>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
              <div className="flex items-center gap-2 text-indigo-500 mb-2">
                <FolderOpen className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Projects</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{data.byProject.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">{fmt(data.totals.regular)} regular</div>
            </div>

            <div className="bg-purple-50 border border-purple-100 rounded-xl p-5">
              <div className="flex items-center gap-2 text-purple-500 mb-2">
                <Coins className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Caja Chica</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{fmt(data.totals.cajaChica)}</div>
              <div className="text-xs text-gray-500 mt-0.5">petty cash spend</div>
            </div>
          </div>

          {/* No data notice */}
          {data.invoiceCount === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8 text-sm text-amber-800">
              No approved &amp; matched invoices found for this period. Approve matches in the{" "}
              <Link href="/matcher/matching" className="font-medium underline">Matcher</Link> to see data here.
            </div>
          )}

          {/* P&L Table */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Expense Classification</h2>
                <p className="text-xs text-gray-500 mt-0.5">By account code · approved matched invoices</p>
              </div>
              <Link
                href={`/preaccounting/entries?period=${period}`}
                className="text-xs text-orange-600 hover:text-orange-700 font-medium"
              >
                View all entries →
              </Link>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-6 py-3 text-left font-medium">Code</th>
                  <th className="px-6 py-3 text-left font-medium">Account</th>
                  <th className="px-4 py-3 text-right font-medium">Invoices</th>
                  <th className="px-4 py-3 text-right font-medium">Line Items</th>
                  <th className="px-6 py-3 text-right font-medium">Amount</th>
                  <th className="px-6 py-3 text-right font-medium">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {allCats.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-sm">
                      No classified expenses yet.
                    </td>
                  </tr>
                ) : (
                  allCats.map((row) => {
                    const pct = data.totals.grand > 0 ? (row.total / data.totals.grand) * 100 : 0;
                    return (
                      <tr key={row.category} className="hover:bg-orange-50/30 transition-colors">
                        <td className="px-6 py-3.5 font-mono text-xs text-gray-400">{row.accountCode}</td>
                        <td className="px-6 py-3.5 font-medium text-gray-800">{row.accountLabel}</td>
                        <td className="px-4 py-3.5 text-right text-gray-500">{row.invoiceCount}</td>
                        <td className="px-4 py-3.5 text-right text-gray-500">{row.lineItemCount}</td>
                        <td className="px-6 py-3.5 text-right font-semibold text-gray-900 tabular-nums">
                          {fmt(row.total)}
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full bg-orange-400 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-400 w-8 text-right tabular-nums">
                              {pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {allCats.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200">
                    <td className="px-6 py-4" />
                    <td className="px-6 py-4 font-bold text-gray-900 uppercase text-xs tracking-wide">
                      Total Expenses
                    </td>
                    <td className="px-4 py-4 text-right text-gray-600 font-medium">{data.invoiceCount}</td>
                    <td className="px-4 py-4 text-right text-gray-600 font-medium">
                      {allCats.reduce((s, r) => s + r.lineItemCount, 0)}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900 text-base tabular-nums">
                      {fmt(data.totals.grand)}
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-gray-400">100%</td>
                  </tr>
                  {data.totals.cajaChica > 0 && (
                    <tr className="bg-purple-50">
                      <td className="px-6 py-2" />
                      <td className="px-6 py-2 text-xs text-purple-700 font-medium">
                        of which: Petty Cash (Caja Chica)
                      </td>
                      <td colSpan={3} className="px-6 py-2 text-right text-xs text-purple-700 font-medium tabular-nums">
                        {fmt(data.totals.cajaChica)}
                      </td>
                      <td />
                    </tr>
                  )}
                </tfoot>
              )}
            </table>
          </div>

          {/* By Project */}
          {data.byProject.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-8">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">By Project</h2>
                <p className="text-xs text-gray-500 mt-0.5">Expense distribution across projects</p>
              </div>
              <div className="divide-y divide-gray-50">
                {data.byProject.map((proj) => {
                  const pct = data.totals.grand > 0 ? (proj.total / data.totals.grand) * 100 : 0;
                  return (
                    <div key={proj.projectId} className="px-6 py-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="w-4 h-4 text-indigo-400" />
                          <span className="font-medium text-gray-800 text-sm">{proj.projectName}</span>
                          <span className="text-xs text-gray-400">{proj.invoiceCount} invoices</span>
                        </div>
                        <span className="font-semibold text-gray-900 tabular-nums">{fmt(proj.total)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-indigo-400 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-10 text-right tabular-nums">{pct.toFixed(1)}%</span>
                      </div>
                      {/* Category breakdown for this project */}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(proj.byCategory)
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 4)
                          .map(([cat, amt]) => (
                            <span key={cat} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                              {cat}: {fmt(amt)}
                            </span>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly Trend */}
          {data.byMonth.length > 1 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Monthly Trend</h2>
                <p className="text-xs text-gray-500 mt-0.5">Expense totals by month</p>
              </div>
              <div className="px-6 py-4 space-y-3">
                {data.byMonth.map((m) => (
                  <div key={m.month} className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 w-20 flex-shrink-0 tabular-nums">
                      {new Date(m.month + "-01").toLocaleString("default", { month: "short", year: "numeric" })}
                    </span>
                    <MonthBar value={m.total} max={maxMonth} />
                    <span className="text-sm font-medium text-gray-700 w-28 text-right tabular-nums flex-shrink-0">
                      {fmt(m.total)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

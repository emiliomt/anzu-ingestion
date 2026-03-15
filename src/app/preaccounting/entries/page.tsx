"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Download, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Entry {
  id: string;
  invoiceId: string;
  referenceNo: string;
  invoiceDate: string;
  vendorName: string;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number;
  currency: string;
  category: string;
  accountCode: string;
  accountLabel: string;
  matchType: string | null;
  matchLabel: string;
  projectId: string | null;
}

interface EntriesResponse {
  entries: Entry[];
  total: number;
  page: number;
  pages: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "",          label: "All Categories" },
  { value: "material",  label: "5100 · Materials & Supplies" },
  { value: "labor",     label: "5200 · Labor & Services" },
  { value: "equipment", label: "5300 · Equipment & Machinery" },
  { value: "freight",   label: "5400 · Freight & Logistics" },
  { value: "overhead",  label: "5500 · Overhead & Utilities" },
  { value: "tax",       label: "5600 · Taxes & Duties" },
  { value: "discount",  label: "5700 · Discounts" },
  { value: "other",     label: "5800 · Other Expenses" },
];

const PERIODS = [
  { value: "month",   label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "ytd",     label: "Year to Date" },
  { value: "all",     label: "All Time" },
];

const MATCH_TYPES = [
  { value: "",                label: "All Types" },
  { value: "project",         label: "Project" },
  { value: "purchase_order",  label: "Purchase Order" },
  { value: "caja_chica",      label: "Caja Chica" },
];

function fmt(amount: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

const CATEGORY_COLORS: Record<string, string> = {
  material:  "bg-blue-100 text-blue-700",
  labor:     "bg-green-100 text-green-700",
  equipment: "bg-amber-100 text-amber-700",
  freight:   "bg-cyan-100 text-cyan-700",
  overhead:  "bg-violet-100 text-violet-700",
  tax:       "bg-red-100 text-red-700",
  discount:  "bg-gray-100 text-gray-600",
  other:     "bg-gray-100 text-gray-500",
};

const MATCH_COLORS: Record<string, string> = {
  project:        "bg-indigo-50 text-indigo-700",
  purchase_order: "bg-amber-50 text-amber-700",
  caja_chica:     "bg-purple-50 text-purple-700",
};

// ── Page ─────────────────────────────────────────────────────────────────────

function EntriesInner() {
  const searchParams = useSearchParams();

  const [period, setPeriod] = useState(searchParams.get("period") ?? "ytd");
  const [category, setCategory] = useState(searchParams.get("category") ?? "");
  const [matchType, setMatchType] = useState(searchParams.get("matchType") ?? "");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<EntriesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      period,
      page: String(page),
      limit: "50",
      ...(category  ? { category }  : {}),
      ...(matchType ? { matchType } : {}),
    });
    try {
      const res = await fetch(`/api/preaccounting/entries?${params}`);
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [period, category, matchType, page]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [period, category, matchType]);

  const exportHref = `/api/preaccounting/export?period=${period}${matchType ? `&matchType=${matchType}` : ""}`;

  return (
    <div className="p-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold tracking-widest text-orange-500 uppercase mb-1">Pre-Accounting</p>
          <h1 className="text-2xl font-bold text-gray-900">Expense Entries</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Line items from approved &amp; matched invoices
            {data ? ` · ${data.total} entries` : ""}
          </p>
        </div>
        <a
          href={exportHref}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors w-fit"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </a>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <div className="flex items-center gap-2 text-gray-400">
          <SlidersHorizontal className="w-4 h-4" />
          <span className="text-xs font-medium text-gray-500">Filters</span>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          {PERIODS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          {CATEGORIES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select
          value={matchType}
          onChange={(e) => setMatchType(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          {MATCH_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {(category || matchType) && (
          <button
            onClick={() => { setCategory(""); setMatchType(""); }}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-medium">Reference</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Vendor</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-left font-medium">Account</th>
                <th className="px-4 py-3 text-left font-medium">Matched To</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">
                    Loading…
                  </td>
                </tr>
              ) : data?.entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">
                    No entries found for the selected filters.
                  </td>
                </tr>
              ) : (
                data?.entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-orange-50/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                      {entry.referenceNo}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {entry.invoiceDate}
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate" title={entry.vendorName}>
                      {entry.vendorName}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={entry.description}>
                      {entry.description}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-xs text-gray-400">{entry.accountCode}</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full font-medium w-fit ${
                            CATEGORY_COLORS[entry.category] ?? "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {entry.accountLabel}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          MATCH_COLORS[entry.matchType ?? ""] ?? "bg-gray-50 text-gray-500"
                        }`}
                      >
                        {entry.matchLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                      {fmt(entry.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {data && data.entries.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td colSpan={6} className="px-4 py-3 text-xs text-gray-500 font-medium">
                    Page {data.page} of {data.pages} · {data.total} total entries
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 tabular-nums">
                    {fmt(data.entries.reduce((s, e) => s + e.amount, 0))}
                    <span className="text-xs text-gray-400 font-normal ml-1">this page</span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {data.pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
            disabled={page === data.pages}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function EntriesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400 text-sm">Loading…</div>}>
      <EntriesInner />
    </Suspense>
  );
}

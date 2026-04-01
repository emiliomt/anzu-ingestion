"use client";

/**
 * /provider/dashboard — Provider's submitted invoice history
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows invoices submitted by this provider across all connected clients.
 * Providers can only see their own invoices — never cross-tenant data.
 */

import { useEffect, useState } from "react";
import {
  FileText, CheckCircle2, Clock, AlertCircle, Search, Filter,
} from "lucide-react";

type Invoice = {
  id: string;
  referenceNo: string;
  status: string;
  channel: string;
  fileName: string;
  submittedAt: string;
  organization?: { name: string } | null;
  extractedData: { fieldName: string; value: string | null }[];
};

type Pagination = { page: number; limit: number; total: number; pages: number };

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  received:   { label: "Received",   color: "#F97316", bg: "#FFF7ED", icon: Clock },
  processing: { label: "Processing", color: "#8B5CF6", bg: "#F5F3FF", icon: Clock },
  extracted:  { label: "Extracted",  color: "#2563EB", bg: "#EFF6FF", icon: FileText },
  reviewed:   { label: "Reviewed",   color: "#0891B2", bg: "#E0F2FE", icon: CheckCircle2 },
  complete:   { label: "Complete",   color: "#10B981", bg: "#ECFDF5", icon: CheckCircle2 },
  error:      { label: "Error",      color: "#EF4444", bg: "#FEF2F2", icon: AlertCircle },
};

export default function ProviderDashboardPage() {
  const [invoices, setInvoices]       = useState<Invoice[]>([]);
  const [pagination, setPagination]   = useState<Pagination | null>(null);
  const [loading, setLoading]         = useState(true);
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState("");

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    fetch(`/api/provider/invoices?${params}`)
      .then((r) => r.json() as Promise<{ invoices: Invoice[]; pagination: Pagination }>)
      .then((data) => {
        setInvoices(data.invoices ?? []);
        setPagination(data.pagination);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  function getField(inv: Invoice, name: string) {
    return inv.extractedData.find((f) => f.fieldName === name)?.value ?? "—";
  }

  const filtered = invoices.filter((inv) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      inv.referenceNo.toLowerCase().includes(s) ||
      inv.fileName.toLowerCase().includes(s) ||
      (inv.organization?.name ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-6 border-b bg-white border-gray-100">
        <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
          My Invoices
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          All invoices you&apos;ve submitted across your connected clients.
        </p>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 border-b bg-white border-gray-100">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by reference, file, or client..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <Filter className="w-4 h-4 text-gray-400" />
          {pagination && (
            <span className="text-xs text-gray-400 ml-auto">
              {pagination.total} invoice{pagination.total !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-500">
            <div className="w-5 h-5 rounded-full border-2 border-gray-200 border-t-orange-500 animate-spin mr-2" />
            Loading invoices…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No invoices found</p>
            <p className="text-xs text-gray-400 mt-1">
              {search ? "Try adjusting your search" : "Submit your first invoice to see it here"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100" style={{ background: "#F8FAFC" }}>
                  {["Reference", "Invoice #", "Client", "Total", "Date", "Status"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((inv) => {
                  const cfg = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.received;
                  const Icon = cfg.icon;
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-orange-600">
                          {inv.referenceNo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{getField(inv, "invoice_number")}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium text-gray-600">
                          {inv.organization?.name ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                        {getField(inv, "total")}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(inv.submittedAt).toLocaleDateString("es-CO")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ background: cfg.bg, color: cfg.color }}
                        >
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500">
              Page {page} of {pagination.pages}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= pagination.pages}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

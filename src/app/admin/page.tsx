"use client";

import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { InvoiceTable } from "@/components/InvoiceTable";
import { InvoiceDetail } from "@/components/InvoiceDetail";
import { MetricsPanel } from "@/components/MetricsPanel";

export default function AdminDashboard() {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [tableRefreshKey, setTableRefreshKey] = useState(0);

  // Close detail panel on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedInvoiceId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 flex items-center justify-between px-6 py-4 flex-shrink-0 pl-16 lg:pl-6">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Invoice Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">Review and manage incoming invoices</p>
        </div>
        <button
          onClick={() => setTableRefreshKey((k) => k + 1)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors bg-white"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </header>

      {/* Metrics */}
      <div className="flex-shrink-0">
        <MetricsPanel />
      </div>

      {/* Content: table + detail panel */}
      <div className="flex flex-1 overflow-hidden border-t border-gray-100">
        <div
          className={`flex flex-col transition-all duration-200 overflow-hidden
            ${selectedInvoiceId ? "w-1/2 lg:w-[45%]" : "w-full"}`}
        >
          <InvoiceTable
            onSelectInvoice={(id) => setSelectedInvoiceId(id)}
            selectedId={selectedInvoiceId ?? undefined}
            refreshKey={tableRefreshKey}
            onBulkDeleted={() => setTableRefreshKey((k) => k + 1)}
          />
        </div>

        {selectedInvoiceId && (
          <div className="flex-1 border-l border-gray-100 overflow-hidden flex flex-col">
            <InvoiceDetail
              invoiceId={selectedInvoiceId}
              onClose={() => setSelectedInvoiceId(null)}
              onStatusChange={() => {/* table auto-refreshes */}}
              onDeleted={() => {
                setSelectedInvoiceId(null);
                setTableRefreshKey((k) => k + 1);
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}

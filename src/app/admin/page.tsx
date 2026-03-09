"use client";

import { useState, useEffect } from "react";
import { InvoiceTable } from "@/components/InvoiceTable";
import { InvoiceDetail } from "@/components/InvoiceDetail";
import { MetricsPanel } from "@/components/MetricsPanel";

export default function AdminDashboard() {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

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
      <header className="h-16 bg-white border-b border-gray-100 flex items-center px-6 flex-shrink-0 pl-16 lg:pl-6">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Invoice Dashboard</h1>
          <p className="text-xs text-gray-400">Review and manage incoming invoices</p>
        </div>
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
          />
        </div>

        {selectedInvoiceId && (
          <div className="flex-1 border-l border-gray-100 overflow-hidden flex flex-col">
            <InvoiceDetail
              invoiceId={selectedInvoiceId}
              onClose={() => setSelectedInvoiceId(null)}
              onStatusChange={() => {/* table auto-refreshes */}}
            />
          </div>
        )}
      </div>
    </>
  );
}

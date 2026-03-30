"use client";

import { useState, useEffect } from "react";
import { InvoiceTable } from "@/components/InvoiceTable";
import { InvoiceDetail } from "@/components/InvoiceDetail";
import { MetricsPanel } from "@/components/MetricsPanel";
import { UnsortedQueueWidget } from "@/components/UnsortedQueueWidget";

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
      {/* Metrics */}
      <div className="flex-shrink-0">
        <MetricsPanel />
        <UnsortedQueueWidget />
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

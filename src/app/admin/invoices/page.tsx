"use client";

import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { InvoiceTable } from "@/components/InvoiceTable";
import { InvoiceDetail } from "@/components/InvoiceDetail";

export default function InvoicesPage() {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Close detail panel on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedInvoiceId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      {/* Top bar */}
      <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0 pl-16 lg:pl-6">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Invoices</h1>
          <p className="text-xs text-gray-400">Search, filter and manage all incoming invoices</p>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          <Download className="w-4 h-4" />
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </header>

      {/* Content: table + detail panel */}
      <div className="flex flex-1 overflow-hidden">
        <div
          className={`flex flex-col transition-all duration-200 overflow-hidden border-r border-gray-100
            ${selectedInvoiceId ? "w-1/2 lg:w-[52%]" : "w-full"}`}
        >
          <InvoiceTable
            onSelectInvoice={(id) => setSelectedInvoiceId(id)}
            selectedId={selectedInvoiceId ?? undefined}
          />
        </div>

        {selectedInvoiceId && (
          <div className="flex-1 overflow-hidden flex flex-col">
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

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Download, RefreshCw, Loader2, AlertCircle,
  CheckCircle2, FileJson, Info, Upload,
} from "lucide-react";
import type { FineTuneListItem, FineTuneListResponse } from "@/types/fine-tune";

type ListResponse = FineTuneListResponse;

function formatAmount(total: number | null, currency: string | null): string {
  if (total == null) return "—";
  const fmt = currency
    ? new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(total)
    : total.toLocaleString("en-US");
  return fmt;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default function FineTunePage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fine-tune/list");
      if (!res.ok) throw new Error(await res.text());
      const json: ListResponse = await res.json();
      setData(json);
      // Auto-select all items that have correctedData
      setSelected(new Set(json.items.filter((i) => i.hasCorrectedData).map((i) => i.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  const toggleAll = () => {
    const exportable = data?.items.filter((i) => i.hasCorrectedData).map((i) => i.id) ?? [];
    if (selected.size === exportable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(exportable));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExport = async (markUploaded: boolean) => {
    if (selected.size === 0) {
      setError("Select at least one invoice to export.");
      return;
    }

    setExporting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/fine-tune/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), markUploaded }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error ?? "Export failed");
      }

      const exportedCount = res.headers.get("X-Exported-Count") ?? "?";
      const skippedCount = res.headers.get("X-Skipped-Count") ?? "0";

      // Trigger file download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const cd = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = cd.match(/filename="([^"]+)"/);
      a.href = url;
      a.download = filenameMatch?.[1] ?? "fine-tune.jsonl";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const msg = `Downloaded ${exportedCount} training example(s).${
        Number(skippedCount) > 0 ? ` ${skippedCount} skipped (missing corrected data).` : ""
      }${markUploaded ? " Invoices marked as UPLOADED." : ""}`;
      setSuccessMsg(msg);

      if (markUploaded) {
        // Refresh list so UPLOADED invoices disappear
        await fetchList();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const exportable = data?.items.filter((i) => i.hasCorrectedData) ?? [];
  const allSelected = exportable.length > 0 && selected.size === exportable.length;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <>
      {/* Header */}
      <header className="h-16 bg-white border-b border-gray-100 flex items-center px-6 flex-shrink-0 pl-16 lg:pl-6">
        <div className="flex-1">
          <h1 className="text-base font-semibold text-gray-900">Fine-Tune Export</h1>
          <p className="text-xs text-gray-400">
            Export human-corrected invoices as JSONL for OpenAI fine-tuning
          </p>
        </div>
        <button
          onClick={fetchList}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Alerts */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        {successMsg && (
          <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {successMsg}
          </div>
        )}

        {/* How it works */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <h2 className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <Info className="w-3.5 h-3.5" />
            How this works
          </h2>
          <p className="text-xs text-blue-700 leading-relaxed">
            Each exported invoice becomes one fine-tuning example: a{" "}
            <strong>system</strong> message (full LATAM extraction prompt) +{" "}
            <strong>user</strong> message (raw OCR text) +{" "}
            <strong>assistant</strong> message (human-corrected JSON output).
            Only invoices with saved corrections (<code className="bg-blue-100 px-1 rounded">correctedData</code>) are exported.
            After download, invoices are marked <span className="font-semibold">UPLOADED</span> so they won&apos;t appear here again.
          </p>
        </div>

        {/* Stats row */}
        {data && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Ready to export", value: data.counts.ready, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100" },
              { label: "Pending correction", value: data.counts.pending, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
              { label: "Already uploaded", value: data.counts.uploaded, color: "text-green-600", bg: "bg-green-50 border-green-100" },
            ].map((s) => (
              <div key={s.label} className={`border rounded-xl p-4 ${s.bg}`}>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Table + action bar */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">

          {/* Action bar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/60">
            <span className="text-xs text-gray-500">
              {selected.size} of {exportable.length} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport(false)}
                disabled={exporting || selected.size === 0}
                title="Download JSONL without marking as UPLOADED"
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileJson className="w-3.5 h-3.5" />
                Preview download
              </button>
              <button
                onClick={() => handleExport(true)}
                disabled={exporting || selected.size === 0}
                className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Download className="w-3.5 h-3.5" />
                }
                Export JSONL for Fine-Tuning
              </button>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
            </div>
          ) : !data || data.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-6">
              <Upload className="w-10 h-10 text-gray-200 mb-3" />
              <p className="text-sm font-medium text-gray-500">No invoices ready for export</p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">
                Open an invoice in the Dashboard, correct its fields, and save — the system
                will automatically set it to <strong>READY</strong> when corrections are saved.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pl-4 pr-2 py-3 text-left w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Reference</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendor</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Last updated</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.items.map((inv) => {
                  const canExport = inv.hasCorrectedData;
                  const isChecked = selected.has(inv.id);
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => canExport && toggleOne(inv.id)}
                      className={`transition-colors ${
                        canExport ? "cursor-pointer hover:bg-gray-50/80" : "opacity-50 cursor-not-allowed"
                      } ${isChecked ? "bg-indigo-50/40" : ""}`}
                    >
                      <td className="pl-4 pr-2 py-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!canExport}
                          onChange={() => toggleOne(inv.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-mono text-xs text-gray-700">{inv.referenceNo}</span>
                      </td>
                      <td className="px-3 py-3 text-gray-800 max-w-[200px] truncate">
                        {inv.vendorName ?? <span className="text-gray-400 italic">Unknown vendor</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-700 font-mono text-xs tabular-nums">
                        {formatAmount(inv.total, inv.currency)}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">
                        {formatDate(inv.updatedAt)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            title={inv.hasOcrText ? "OCR text available" : "No OCR text"}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                              inv.hasOcrText
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-gray-100 text-gray-500 border-gray-200"
                            }`}
                          >
                            OCR
                          </span>
                          <span
                            title={inv.hasCorrectedData ? "Corrected data saved" : "No corrections — cannot export"}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                              inv.hasCorrectedData
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                : "bg-red-50 text-red-600 border-red-200"
                            }`}
                          >
                            {inv.hasCorrectedData ? "Corrected" : "No corrections"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer note */}
        <p className="text-xs text-gray-400 text-center">
          The exported JSONL uses OpenAI fine-tuning format:{" "}
          <code className="bg-gray-100 px-1 rounded">
            {`{ "messages": [system, user, assistant] }`}
          </code>{" "}
          — one JSON object per line.
          Upload directly to{" "}
          <span className="font-medium text-gray-500">platform.openai.com → Fine-tuning</span>.
        </p>

      </div>
    </>
  );
}

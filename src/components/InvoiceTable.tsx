"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Filter, Download, RefreshCw, ChevronLeft, ChevronRight, Trash2, FileOutput, Loader2, X } from "lucide-react";
import { StatusBadge, ChannelBadge } from "./StatusBadge";
import type { InvoiceListItem } from "@/types/invoice";
import { format } from "date-fns";

interface InvoiceTableProps {
  onSelectInvoice: (id: string) => void;
  selectedId?: string;
  refreshKey?: number;
  onBulkDeleted?: () => void;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function shortenModelLabel(modelId: string): string {
  if (modelId.length <= 24) return modelId;
  return `${modelId.slice(0, 21)}...`;
}

export function InvoiceTable({ onSelectInvoice, selectedId, refreshKey, onBulkDeleted }: InvoiceTableProps) {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1, limit: 25, total: 0, totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  // ERP export
  const [showErpModal, setShowErpModal] = useState(false);
  const [erpProfiles, setErpProfiles] = useState<{ id: string; name: string }[]>([]);
  const [selectedErpProfileId, setSelectedErpProfileId] = useState<string>("sinco");
  const [erpExporting, setErpExporting] = useState(false);
  const [erpToast, setErpToast] = useState<string | null>(null);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);

  const fetchActiveModel = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json() as { finetune_model_id?: string | null };
      const modelId = typeof data.finetune_model_id === "string" && data.finetune_model_id.trim()
        ? data.finetune_model_id.trim()
        : null;
      setActiveModelId(modelId);
    } catch (err) {
      console.error("Failed to fetch active extraction model:", err);
    }
  }, []);

  const fetchInvoices = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "25",
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(channelFilter && { channel: channelFilter }),
        ...(flaggedOnly && { flagged: "true" }),
      });

      const res = await fetch(`/api/invoices?${params}`);
      const data = await res.json() as { invoices: InvoiceListItem[]; pagination: PaginationData };
      setInvoices(data.invoices);
      setPagination(data.pagination);
    } catch (err) {
      console.error("Failed to fetch invoices:", err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, channelFilter, flaggedOnly]);

  useEffect(() => {
    fetchInvoices(1);
    const interval = setInterval(() => fetchInvoices(pagination.page), 15000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, channelFilter, flaggedOnly, refreshKey]);

  useEffect(() => {
    fetchActiveModel();
    const interval = setInterval(fetchActiveModel, 30000);
    return () => clearInterval(interval);
  }, [fetchActiveModel]);

  // Clear selection when the list refreshes
  useEffect(() => { setCheckedIds(new Set()); }, [refreshKey]);

  const allChecked = invoices.length > 0 && invoices.every((inv) => checkedIds.has(inv.id));
  const someChecked = invoices.some((inv) => checkedIds.has(inv.id));

  const toggleAll = () => {
    if (allChecked) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(invoices.map((inv) => inv.id)));
    }
  };

  const toggleOne = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      await fetch("/api/invoices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(checkedIds) }),
      });
      setCheckedIds(new Set());
      setConfirmBulkDelete(false);
      onBulkDeleted?.();
      fetchInvoices(pagination.page);
    } catch (err) {
      console.error(err);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    setDeletingAll(true);
    try {
      await fetch("/api/invoices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteAll: true }),
      });
      setCheckedIds(new Set());
      setConfirmDeleteAll(false);
      setConfirmBulkDelete(false);
      onBulkDeleted?.();
      await fetchInvoices(1);
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingAll(false);
    }
  };

  const openErpModal = async () => {
    try {
      const res = await fetch("/api/erp-profiles");
      const data = await res.json() as { profiles: { id: string; name: string }[] };
      setErpProfiles(data.profiles ?? []);
    } catch { /* ignore */ }
    setShowErpModal(true);
  };

  const handleErpExport = async () => {
    setErpExporting(true);
    try {
      const res = await fetch("/api/export/erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceIds: Array.from(checkedIds),
          profileId: selectedErpProfileId,
        }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        alert(err.error ?? "Export failed");
        return;
      }

      // Trigger browser download
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const fileName = match?.[1] ?? "erp_export.xlsx";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      const profileLabel =
        selectedErpProfileId === "sinco"
          ? "SINCO ERP"
          : (erpProfiles.find((p) => p.id === selectedErpProfileId)?.name ?? "Custom");

      setShowErpModal(false);
      setErpToast(`Exported ${checkedIds.size} invoice${checkedIds.size !== 1 ? "s" : ""} to ${profileLabel}`);
      setTimeout(() => setErpToast(null), 4000);
    } catch {
      alert("Network error during export");
    } finally {
      setErpExporting(false);
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams({
      ...(statusFilter && { status: statusFilter }),
      ...(channelFilter && { channel: channelFilter }),
    });
    window.open(`/api/export?${params}`, "_blank");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="p-4 border-b border-gray-100 bg-white space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search vendor, reference, file name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>
          <button
            onClick={() => fetchInvoices(1)}
            className="btn-secondary p-2"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={handleExport} className="btn-secondary">
            <Download className="w-4 h-4" />
            Export
          </button>
          {!confirmDeleteAll ? (
            <button
              onClick={() => {
                setConfirmDeleteAll(true);
                setConfirmBulkDelete(false);
              }}
              className="btn-secondary text-red-600 border-red-200 hover:bg-red-50"
              title="Delete every invoice in this organization"
            >
              <Trash2 className="w-4 h-4" />
              Delete all
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1">
              <span className="text-xs text-red-700 font-medium">Delete ALL invoices?</span>
              <button
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className="text-xs px-2.5 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deletingAll ? "Deleting…" : "Yes"}
              </button>
              <button
                onClick={() => setConfirmDeleteAll(false)}
                disabled={deletingAll}
                className="text-xs px-2.5 py-1 border border-red-200 text-red-700 rounded-md hover:bg-red-100 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input py-1.5 w-auto text-xs"
          >
            <option value="">All Statuses</option>
            <option value="received">Received</option>
            <option value="processing">Processing</option>
            <option value="extracted">Extracted</option>
            <option value="reviewed">Reviewed</option>
            <option value="complete">Complete</option>
            <option value="error">Error</option>
          </select>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="input py-1.5 w-auto text-xs"
          >
            <option value="">All Channels</option>
            <option value="web">Web</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={(e) => setFlaggedOnly(e.target.checked)}
              className="rounded text-indigo-600"
            />
            Flagged only
          </label>
          <div className="ml-auto flex items-center gap-2">
            <span
              title={activeModelId ?? "gpt-4.1-mini-2025-04-14"}
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                activeModelId
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 bg-gray-50 text-gray-600"
              }`}
            >
              {activeModelId
                ? `Model: ${shortenModelLabel(activeModelId)}`
                : "Model: Base"}
            </span>
            <span className="text-xs text-gray-400">
              {pagination.total} invoices
            </span>
          </div>
        </div>

        {/* Bulk actions bar */}
        {someChecked && (
          <div className="flex items-center gap-2 px-1 py-1 bg-indigo-50 border border-indigo-100 rounded-lg">
            <span className="text-xs text-indigo-700 font-medium flex-1">
              {checkedIds.size} selected
            </span>
            <button
              onClick={openErpModal}
              className="flex items-center gap-1.5 text-xs px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              <FileOutput className="w-3 h-3" />
              Export to ERP
            </button>
            {!confirmBulkDelete ? (
              <button
                onClick={() => setConfirmBulkDelete(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Delete selected
              </button>
            ) : (
              <>
                <span className="text-xs text-red-700 font-medium">Confirm delete {checkedIds.size} invoice{checkedIds.size > 1 ? "s" : ""}?</span>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="text-xs px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {bulkDeleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  onClick={() => setConfirmBulkDelete(false)}
                  className="text-xs px-3 py-1 border border-red-200 text-red-600 rounded-md hover:bg-red-100 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading && invoices.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading...
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <p>No invoices found</p>
            {(search || statusFilter || channelFilter) && (
              <button
                className="mt-2 text-sm text-indigo-500 hover:underline"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setChannelFilter("");
                  setFlaggedOnly(false);
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                    onChange={toggleAll}
                    className="rounded text-indigo-600 cursor-pointer"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Reference
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Vendor
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Amount
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Channel
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Submitted
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Confidence
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">
                  Flags
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => onSelectInvoice(inv.id)}
                  className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                    selectedId === inv.id ? "bg-indigo-50" : ""
                  } ${checkedIds.has(inv.id) ? "bg-red-50 hover:bg-red-50" : ""}`}
                >
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checkedIds.has(inv.id)}
                      onChange={() => toggleOne(inv.id)}
                      className="rounded text-indigo-600 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-medium text-indigo-700">
                      {inv.referenceNo}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800 truncate max-w-[160px]">
                      {inv.vendorName ?? (
                        <span className="text-gray-400 italic">Unknown</span>
                      )}
                    </div>
                    {inv.submittedBy && (
                      <div className="text-xs text-gray-400 truncate max-w-[160px]">
                        {inv.submittedBy}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {inv.totalAmount ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <ChannelBadge channel={inv.channel} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {format(new Date(inv.submittedAt), "MMM d, HH:mm")}
                  </td>
                  <td className="px-4 py-3">
                    {inv.confidence != null ? (
                      <div className="flex items-center gap-2 min-w-[80px]">
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{
                              width: `${inv.confidence}%`,
                              background:
                                inv.confidence >= 90 ? "#10B981"
                                : inv.confidence >= 75 ? "#F59E0B"
                                : "#EF4444",
                            }}
                          />
                        </div>
                        <span
                          className="text-xs font-medium tabular-nums"
                          style={{
                            color:
                              inv.confidence >= 90 ? "#10B981"
                              : inv.confidence >= 75 ? "#F59E0B"
                              : "#EF4444",
                          }}
                        >
                          {inv.confidence}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {inv.isDuplicate && (
                        <span className="badge bg-orange-50 text-orange-600 border border-orange-100">
                          dup
                        </span>
                      )}
                      {inv.flags.map((flag) => (
                        <span
                          key={flag}
                          className="badge bg-red-50 text-red-600 border border-red-100"
                        >
                          {flag.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-white">
          <span className="text-xs text-gray-500">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={pagination.page <= 1}
              onClick={() => fetchInvoices(pagination.page - 1)}
              className="btn-secondary p-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchInvoices(pagination.page + 1)}
              className="btn-secondary p-1.5 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ERP Export Modal */}
      {showErpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-sm mx-4 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileOutput className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-semibold text-gray-800">Export to ERP</span>
              </div>
              <button
                onClick={() => setShowErpModal(false)}
                className="p-1 hover:bg-gray-100 rounded text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Exporting <strong>{checkedIds.size}</strong> invoice{checkedIds.size !== 1 ? "s" : ""}.
              Select the ERP format:
            </p>

            <div className="space-y-2">
              {/* SINCO preset */}
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50">
                <input
                  type="radio"
                  name="erpProfile"
                  value="sinco"
                  checked={selectedErpProfileId === "sinco"}
                  onChange={() => setSelectedErpProfileId("sinco")}
                  className="mt-0.5 text-indigo-600"
                />
                <div>
                  <div className="text-xs font-semibold text-gray-800">SINCO ERP</div>
                  <div className="text-[11px] text-gray-400">Colombia — CONTABILIDAD sheet · 15 columns</div>
                </div>
              </label>

              {/* Custom profiles */}
              {erpProfiles.map((p) => (
                <label
                  key={p.id}
                  className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50"
                >
                  <input
                    type="radio"
                    name="erpProfile"
                    value={p.id}
                    checked={selectedErpProfileId === p.id}
                    onChange={() => setSelectedErpProfileId(p.id)}
                    className="mt-0.5 text-indigo-600"
                  />
                  <div>
                    <div className="text-xs font-semibold text-gray-800">{p.name}</div>
                    <div className="text-[11px] text-gray-400">Custom profile</div>
                  </div>
                </label>
              ))}

              {erpProfiles.length === 0 && (
                <p className="text-xs text-gray-400 px-1">
                  No custom profiles yet. Configure them in Settings → ERP Export Settings.
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleErpExport}
                disabled={erpExporting}
                className="flex-1 flex items-center justify-center gap-2 text-xs px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {erpExporting
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Exporting…</>
                  : <><FileOutput className="w-3.5 h-3.5" /> Download File</>}
              </button>
              <button
                onClick={() => setShowErpModal(false)}
                className="text-xs px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {erpToast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-gray-900 text-white text-xs px-4 py-2.5 rounded-full shadow-lg">
          <FileOutput className="w-3.5 h-3.5 text-indigo-300" />
          {erpToast}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Filter, Download, RefreshCw, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
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
          <span className="ml-auto text-xs text-gray-400">
            {pagination.total} invoices
          </span>
        </div>

        {/* Bulk delete bar */}
        {someChecked && (
          <div className="flex items-center gap-2 px-1 py-1 bg-red-50 border border-red-100 rounded-lg">
            <span className="text-xs text-red-700 font-medium flex-1">
              {checkedIds.size} selected
            </span>
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
    </div>
  );
}

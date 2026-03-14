"use client";

import { useEffect, useState, useCallback } from "react";
import { DollarSign, Clock, CheckCircle, RefreshCw, Pencil, Loader2, X, Check, Settings } from "lucide-react";

interface PettyCashStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  assigned: number;
  totalValue: number;
}

interface PettyCashInvoice {
  matchId: string;
  invoiceId: string;
  referenceNo: string;
  vendorName: string | null;
  total: string | null;
  currency: string | null;
  invoiceDate: string | null;
  submittedAt: string;
  approvalStatus: string;
  fundName: string | null;
  fundId: string | null;
}

const APPROVAL_COLORS: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
  assigned: "bg-blue-100 text-blue-700",
};

function parseAmount(val: string | null): number | null {
  if (!val) return null;
  const n = parseFloat(val.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? null : n;
}

export default function CajaChicaPage() {
  const [stats, setStats] = useState<PettyCashStats>({ total: 0, pending: 0, approved: 0, rejected: 0, assigned: 0, totalValue: 0 });
  const [invoices, setInvoices] = useState<PettyCashInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [threshold, setThreshold] = useState<number>(400000);
  const [editingThreshold, setEditingThreshold] = useState(false);
  const [thresholdInput, setThresholdInput] = useState("");
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalcResult, setRecalcResult] = useState<{ created: number; removed: number } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>("COP");

  const loadData = useCallback(async () => {
    setLoading(true);
    const [thresholdRes, invoicesRes, settingsRes] = await Promise.all([
      fetch("/api/caja-chica/threshold").then((r) => r.json() as Promise<{ threshold: number }>),
      fetch("/api/caja-chica/invoices").then((r) => r.json() as Promise<{ stats: PettyCashStats; invoices: PettyCashInvoice[] }>),
      fetch("/api/settings").then((r) => r.json() as Promise<{ default_currency: string }>),
    ]);
    setThreshold(thresholdRes.threshold);
    setStats(invoicesRes.stats);
    setInvoices(invoicesRes.invoices);
    setCurrency(settingsRes.default_currency ?? "COP");
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredInvoices = activeTab === "all"
    ? invoices
    : invoices.filter((i) => i.approvalStatus === activeTab);

  async function saveThreshold() {
    const val = parseFloat(thresholdInput);
    if (isNaN(val) || val < 0) return;
    setSavingThreshold(true);
    await fetch("/api/caja-chica/threshold", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threshold: val }),
    });
    setThreshold(val);
    setSavingThreshold(false);
    setEditingThreshold(false);
  }

  async function recalculate() {
    setRecalculating(true);
    setRecalcResult(null);
    const res = await fetch("/api/caja-chica/recalculate", { method: "POST" })
      .then((r) => r.json() as Promise<{ created: number; removed: number; threshold: number }>);
    setRecalcResult({ created: res.created, removed: res.removed });
    setRecalculating(false);
    await loadData();
  }

  async function updateStatus(matchId: string, newStatus: string) {
    setUpdatingId(matchId);
    await fetch("/api/caja-chica/invoices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, approvalStatus: newStatus }),
    });
    setUpdatingId(null);
    await loadData();
  }

  const statCards = [
    {
      label: "Total Petty Cash",
      value: stats.total,
      icon: <DollarSign className="w-5 h-5 text-blue-500" />,
      bg: "bg-blue-50",
    },
    {
      label: "Pending Approval",
      value: stats.pending,
      icon: <Clock className="w-5 h-5 text-amber-500" />,
      bg: "bg-amber-50",
    },
    {
      label: "Approved",
      value: stats.approved,
      icon: <CheckCircle className="w-5 h-5 text-green-500" />,
      bg: "bg-green-50",
    },
    {
      label: "Total Value",
      value: `$${stats.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: <DollarSign className="w-5 h-5 text-purple-500" />,
      bg: "bg-purple-50",
    },
    {
      label: "Assigned",
      value: stats.assigned,
      icon: <DollarSign className="w-5 h-5 text-indigo-500" />,
      bg: "bg-indigo-50",
    },
  ];

  const tabs = [
    { key: "all",      label: "All",      count: stats.total },
    { key: "pending",  label: "Pending",  count: stats.pending },
    { key: "approved", label: "Approved", count: stats.approved },
    { key: "rejected", label: "Rejected", count: stats.rejected },
    { key: "assigned", label: "Assigned", count: stats.assigned },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Petty Cash Management</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage small invoice approvals and cost center assignments</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            </div>
            <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
              {card.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Configuration */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Petty Cash Configuration</h2>
          <button
            onClick={recalculate}
            disabled={recalculating}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? "animate-spin" : ""}`} />
            Recalculate
          </button>
        </div>

        {recalcResult && (
          <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            Recalculated: <strong>{recalcResult.created}</strong> invoice(s) added,{" "}
            <strong>{recalcResult.removed}</strong> removed from petty cash.
          </div>
        )}

        <div className="flex items-center gap-4 py-3 border-t border-gray-100">
          <Settings className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Petty Cash Threshold ({currency})</p>
            <p className="text-xs text-gray-500">Invoices below this amount will be classified as petty cash</p>
          </div>
          {editingThreshold ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveThreshold(); if (e.key === "Escape") setEditingThreshold(false); }}
                className="w-36 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="400000"
                autoFocus
              />
              <button
                onClick={saveThreshold}
                disabled={savingThreshold}
                className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {savingThreshold ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setEditingThreshold(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">
                {threshold.toLocaleString()} {currency}
              </span>
              <button
                onClick={() => { setThresholdInput(String(threshold)); setEditingThreshold(true); }}
                className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border border-gray-200 rounded-xl p-1 bg-white w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-gray-100 text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-md ${
              activeTab === tab.key ? "bg-white text-gray-700" : "bg-gray-100 text-gray-500"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Invoice table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-600" />
          <h2 className="font-semibold text-gray-900">Petty Cash Management</h2>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 py-12 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No petty cash invoices found.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Invoice</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-3">Vendor</th>
                <th className="text-right text-xs font-medium text-gray-500 px-3 py-3">Amount</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-3">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 px-3 py-3">Status</th>
                <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv) => {
                const amount = parseAmount(inv.total);
                return (
                  <tr key={inv.matchId} className="border-b border-gray-50 hover:bg-gray-50 transition-colors last:border-0">
                    <td className="px-5 py-3 text-sm font-mono text-gray-700">{inv.referenceNo}</td>
                    <td className="px-3 py-3 text-sm text-gray-600">{inv.vendorName ?? "—"}</td>
                    <td className="px-3 py-3 text-sm text-right font-medium text-gray-900">
                      {amount != null
                        ? `${inv.currency ?? "USD"} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-500">
                      {inv.invoiceDate ?? new Date(inv.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${APPROVAL_COLORS[inv.approvalStatus] ?? "bg-gray-100 text-gray-600"}`}>
                        {inv.approvalStatus}
                      </span>
                      {inv.fundName && (
                        <span className="ml-2 text-xs text-gray-400">{inv.fundName}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {updatingId === inv.matchId ? (
                        <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-auto" />
                      ) : inv.approvalStatus === "pending" ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => updateStatus(inv.matchId, "approved")}
                            className="p-1.5 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-colors"
                            title="Approve"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => updateStatus(inv.matchId, "rejected")}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors"
                            title="Reject"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : inv.approvalStatus === "approved" ? (
                        <button
                          onClick={() => updateStatus(inv.matchId, "assigned")}
                          className="px-3 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg font-medium transition-colors"
                        >
                          Assign
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

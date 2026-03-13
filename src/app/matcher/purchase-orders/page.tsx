"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, ShoppingCart, Loader2, X, Check } from "lucide-react";
import type { PurchaseOrder, Project } from "@/types/invoice";

const STATUS_COLORS: Record<string, string> = {
  open:               "bg-blue-100 text-blue-700",
  partially_matched:  "bg-amber-100 text-amber-700",
  fully_matched:      "bg-green-100 text-green-700",
  closed:             "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  open:              "Open",
  partially_matched: "Partial",
  fully_matched:     "Matched",
  closed:            "Closed",
};

const EMPTY: Partial<PurchaseOrder & { projectId: string }> = {
  poNumber: "", vendorName: "", description: "", currency: "COP", status: "open",
};

export default function PurchaseOrdersPage() {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [form, setForm] = useState<Partial<PurchaseOrder & { projectId: string }>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [poData, projData] = await Promise.all([
      fetch("/api/purchase-orders").then((r) => r.json() as Promise<PurchaseOrder[]>),
      fetch("/api/projects?status=active").then((r) => r.json() as Promise<Project[]>),
    ]);
    setPos(poData);
    setProjects(projData);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setShowForm(true);
  }

  function openEdit(po: PurchaseOrder) {
    setEditing(po);
    setForm({ ...po, projectId: po.projectId ?? "" });
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        projectId: form.projectId || null,
      };
      if (editing) {
        await fetch(`/api/purchase-orders/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/purchase-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this PO? This cannot be undone.")) return;
    setDeleting(id);
    await fetch(`/api/purchase-orders/${id}`, { method: "DELETE" });
    setDeleting(null);
    await load();
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-gray-500 text-sm mt-0.5">Upload and manage purchase orders for invoice matching.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New PO
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : pos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No purchase orders yet</p>
          <p className="text-sm mt-1">Add POs to enable automatic invoice matching.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">PO Number</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Project</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vendor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Matched</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pos.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">{po.poNumber}</td>
                  <td className="px-4 py-3 text-gray-500">{po.projectName ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{po.vendorName ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {po.totalAmount != null
                      ? `${po.currency} ${po.totalAmount.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[po.status] ?? ""}`}>
                      {STATUS_LABELS[po.status] ?? po.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{po._count?.invoiceMatches ?? 0} invoice{(po._count?.invoiceMatches ?? 0) !== 1 ? "s" : ""}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEdit(po)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => del(po.id)}
                        disabled={deleting === po.id}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600"
                      >
                        {deleting === po.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editing ? "Edit Purchase Order" : "New Purchase Order"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">PO Number *</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={form.poNumber ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, poNumber: e.target.value }))}
                    placeholder="OC-2025-001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Project</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={form.projectId ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                  >
                    <option value="">— None —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Vendor Name</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={form.vendorName ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, vendorName: e.target.value }))}
                    placeholder="Proveedor S.A.S."
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Total Amount</label>
                  <input
                    type="number"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={form.totalAmount ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={form.currency ?? "COP"}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
                  >
                    {["COP","USD","MXN","ARS","BRL","PEN","CLP","EUR"].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Issue Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={form.issueDate ? form.issueDate.slice(0, 10) : ""}
                    onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value || undefined }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={form.status ?? "open"}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as PurchaseOrder["status"] }))}
                  >
                    <option value="open">Open</option>
                    <option value="partially_matched">Partially Matched</option>
                    <option value="fully_matched">Fully Matched</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                  <textarea
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                    rows={2}
                    value={form.description ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Optional description of what this PO covers"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !form.poNumber?.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {editing ? "Save Changes" : "Create PO"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

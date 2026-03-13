"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Coins, Loader2, X, Check } from "lucide-react";
import type { CajaChica } from "@/types/invoice";

const STATUS_COLORS: Record<string, string> = {
  open:   "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-600",
};

export default function CajaChicaPage() {
  const [funds, setFunds] = useState<CajaChica[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CajaChica | null>(null);
  const [form, setForm] = useState<Partial<CajaChica>>({ name: "", currency: "COP", status: "open" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch("/api/caja-chica").then((r) => r.json() as Promise<CajaChica[]>);
    setFunds(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", currency: "COP", status: "open" });
    setShowForm(true);
  }

  function openEdit(cc: CajaChica) {
    setEditing(cc);
    setForm({ ...cc });
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editing) {
        await fetch("/api/caja-chica", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editing.id, ...form }),
        });
      } else {
        await fetch("/api/caja-chica", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Caja Chica</h1>
          <p className="text-gray-500 text-sm mt-0.5">Petty cash funds for minor expenses without a PO.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Fund
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : funds.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Coins className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No caja chica funds yet</p>
          <p className="text-sm mt-1">Create a fund to capture minor expense invoices.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {funds.map((cc) => (
            <div key={cc.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{cc.name}</p>
                  {cc.period && <p className="text-xs text-gray-400 mt-0.5">Period: {cc.period}</p>}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[cc.status] ?? ""}`}>
                  {cc.status}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold text-gray-900">
                    {cc.balance != null ? `${cc.currency} ${cc.balance.toLocaleString()}` : "—"}
                  </p>
                  <p className="text-xs text-gray-400">{cc._count?.invoiceMatches ?? 0} invoice(s) matched</p>
                </div>
                <button
                  onClick={() => openEdit(cc)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-500"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editing ? "Edit Fund" : "New Caja Chica Fund"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fund Name *</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  value={form.name ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Caja Chica Obra Norte Q1-2025"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Period</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={form.period ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
                    placeholder="Q1-2025"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Balance</label>
                  <input
                    type="number"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={form.balance ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value ? Number(e.target.value) : undefined }))}
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
                    {["COP","USD","MXN","ARS","BRL","EUR"].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    value={form.status ?? "open"}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CajaChica["status"] }))}
                  >
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button
                onClick={save}
                disabled={saving || !form.name?.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {editing ? "Save Changes" : "Create Fund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

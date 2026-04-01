"use client";

/**
 * /admin/organizations — Organization (tenant) management (ADMIN only)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from "react";
import { Building2, Plus, Users, FileText, CheckCircle2, XCircle } from "lucide-react";

type Org = {
  id: string;
  slug: string;
  name: string;
  taxId?: string;
  country: string;
  plan: string;
  isActive: boolean;
  createdAt: string;
  _count: { users: number; invoices: number; providerConnections: number };
};

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  Enterprise: { bg: "#FEF3C7", text: "#92400E" },
  Growth:     { bg: "#DCFCE7", text: "#166534" },
  Starter:    { bg: "#EFF6FF", text: "#1D4ED8" },
};

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs]           = useState<Org[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", taxId: "", country: "CO", plan: "Starter" as string });
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => { loadOrgs(); }, []);

  async function loadOrgs() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/organizations");
      const data = await res.json() as { organizations: Org[] };
      setOrgs(data.organizations ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to create organization"); return; }
      setShowCreate(false);
      setForm({ name: "", slug: "", taxId: "", country: "CO", plan: "Starter" });
      await loadOrgs();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(orgId: string, current: boolean) {
    await fetch(`/api/admin/organizations/${orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    await loadOrgs();
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-6 border-b bg-white border-gray-100 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
            Organizations
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage client tenants and subscription plans.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
        >
          <Plus className="w-4 h-4" /> New Organization
        </button>
      </div>

      {/* Create form modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            <h2 className="text-lg font-bold text-gray-900 mb-4">New Organization</h2>
            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
            <div className="space-y-3">
              {[
                { key: "name", label: "Company Name", placeholder: "Constructora Bogotá S.A.S." },
                { key: "slug", label: "Slug (URL ID)", placeholder: "constructora-bogota" },
                { key: "taxId", label: "Tax ID / NIT", placeholder: "900.123.456-7" },
                { key: "country", label: "Country Code", placeholder: "CO" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Subscription Plan</label>
                <select
                  value={form.plan}
                  onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
                >
                  <option>Starter</option>
                  <option>Growth</option>
                  <option>Enterprise</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !form.name || !form.slug}
                className="flex-1 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
              >
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="px-6 py-6">
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
            <div className="w-4 h-4 rounded-full border-2 border-gray-200 border-t-orange-500 animate-spin" />
            Loading organizations…
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100" style={{ background: "#F8FAFC" }}>
                  {["Organization", "Tax ID", "Plan", "Users", "Invoices", "Status", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orgs.map((org) => {
                  const planStyle = PLAN_COLORS[org.plan] ?? PLAN_COLORS.Starter;
                  return (
                    <tr key={org.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                          <div>
                            <p className="font-medium text-gray-900">{org.name}</p>
                            <p className="text-xs text-gray-400 font-mono">{org.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{org.taxId || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: planStyle.bg, color: planStyle.text }}>
                          {org.plan}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs text-gray-600">
                          <Users className="w-3 h-3" />{org._count.users}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs text-gray-600">
                          <FileText className="w-3 h-3" />{org._count.invoices}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {org.isActive
                          ? <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="w-3 h-3" />Active</span>
                          : <span className="flex items-center gap-1 text-xs text-red-500"><XCircle className="w-3 h-3" />Inactive</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActive(org.id, org.isActive)}
                          className="text-xs text-gray-400 hover:text-gray-600 underline"
                        >
                          {org.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

/**
 * /client/settings — Organization profile management
 */

import { useEffect, useState } from "react";
import { Save, Building2, CheckCircle } from "lucide-react";

interface OrgSettings {
  id: string;
  name: string;
  slug: string;
  taxId: string | null;
  country: string;
  plan: string;
}

const COUNTRIES = [
  { code: "CO", label: "Colombia" },
  { code: "MX", label: "Mexico" },
  { code: "PE", label: "Peru" },
  { code: "CL", label: "Chile" },
  { code: "AR", label: "Argentina" },
  { code: "EC", label: "Ecuador" },
  { code: "US", label: "United States" },
];

export default function ClientSettingsPage() {
  const [org, setOrg] = useState<OrgSettings | null>(null);
  const [form, setForm] = useState({ name: "", taxId: "", country: "CO" });
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/client/settings")
      .then((r) => r.json())
      .then((d: { org?: OrgSettings }) => {
        if (d.org) {
          setOrg(d.org);
          setForm({ name: d.org.name, taxId: d.org.taxId ?? "", country: d.org.country });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/client/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, taxId: form.taxId || undefined, country: form.country }),
      });
      const data = await res.json() as { org?: OrgSettings; error?: string };
      if (!res.ok) { setError(data.error ?? "Save failed"); return; }
      if (data.org) setOrg(data.org);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#FFF7ED" }}>
          <Building2 className="w-5 h-5" style={{ color: "#F97316" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Organization Settings</h1>
          {org && <p className="text-xs text-gray-500">/{org.slug}</p>}
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Company Name <span className="text-red-500">*</span>
          </label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Tax ID (NIT / RFC / RUT)</label>
          <input
            value={form.taxId}
            onChange={(e) => setForm({ ...form, taxId: e.target.value })}
            placeholder="Optional"
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Country</label>
          <select
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
          >
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </div>

        {/* Read-only plan info */}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Subscription Plan</p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{org?.plan ?? "Starter"}</p>
            </div>
            <a
              href="/client/billing"
              className="text-xs font-medium text-orange-600 hover:text-orange-700"
            >
              Manage billing →
            </a>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
          style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
        >
          {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}

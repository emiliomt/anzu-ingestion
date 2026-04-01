"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Save, RefreshCw, AlertCircle } from "lucide-react";

interface Config {
  expected_buyer_name:     string;
  expected_buyer_tax_id:   string;
  expected_buyer_address:  string;
  name_match_threshold:    string;
  address_match_threshold: string;
  forward_url:     string;
  forward_api_key: string;
}

const EMPTY: Config = {
  expected_buyer_name:     "",
  expected_buyer_tax_id:   "",
  expected_buyer_address:  "",
  name_match_threshold:    "85",
  address_match_threshold: "80",
  forward_url:     "",
  forward_api_key: "",
};

export default function SecuritySettingsPage() {
  const [form, setForm] = useState<Config>(EMPTY);
  const [connected, setConnected] = useState<boolean | null>(null); // null = loading
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [satStatus, setSatStatus] = useState<{
    loaded: boolean; downloaded_at?: string; row_count?: number
  } | null>(null);

  useEffect(() => {
    // Load existing config via Next.js proxy (uses SECURITY_SERVICE_URL server-side)
    fetch("/api/security/settings/default")
      .then((r) => {
        if (r.status === 503) { setConnected(false); return null; }
        setConnected(true);
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        if (!data) return;
        setForm({
          expected_buyer_name:     data.expected_buyer_name    ?? "",
          expected_buyer_tax_id:   data.expected_buyer_tax_id  ?? "",
          expected_buyer_address:  data.expected_buyer_address ?? "",
          name_match_threshold:    String(data.name_match_threshold    ?? 85),
          address_match_threshold: String(data.address_match_threshold ?? 80),
          forward_url:    data.forward_url ?? "",
          forward_api_key: "",
        });
      })
      .catch(() => setConnected(false));

    fetch("/api/security/sat")
      .then((r) => r.ok ? r.json() : null)
      .then(setSatStatus)
      .catch(() => {});
  }, []);

  const field = (key: keyof Config) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const body: Record<string, string | number | null> = {
        expected_buyer_name:     form.expected_buyer_name     || null,
        expected_buyer_tax_id:   form.expected_buyer_tax_id   || null,
        expected_buyer_address:  form.expected_buyer_address  || null,
        name_match_threshold:    form.name_match_threshold    ? parseFloat(form.name_match_threshold)    : null,
        address_match_threshold: form.address_match_threshold ? parseFloat(form.address_match_threshold) : null,
        forward_url:     form.forward_url     || null,
        forward_api_key: form.forward_api_key || null,
      };
      const resp = await fetch("/api/security/settings/default", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error ?? `${resp.status} ${resp.statusText}`);
      }
      setStatus({ type: "success", msg: "Settings saved successfully." });
    } catch (err) {
      setStatus({ type: "error", msg: String(err) });
    } finally {
      setSaving(false);
    }
  }

  async function handleSatRefresh() {
    setRefreshing(true);
    setStatus(null);
    try {
      const resp = await fetch("/api/security/sat", { method: "POST" });
      if (!resp.ok) throw new Error(`${resp.status}`);
      setStatus({ type: "success", msg: "SAT list refresh scheduled. It may take a few minutes." });
    } catch (err) {
      setStatus({ type: "error", msg: String(err) });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-gray-900 font-bold text-xl">Security Settings</h1>
        <p className="text-gray-500 text-xs mt-0.5">Configure buyer verification rules and SAT blacklist checks</p>
      </div>

      {/* Connection state */}
      {connected === false && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Security service not deployed yet</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Deploy <strong>anzu-security</strong> to Railway (the <code className="bg-amber-100 px-1 rounded">anzu-security/</code> folder in this repo),
              then set <code className="bg-amber-100 px-1 rounded">SECURITY_SERVICE_URL</code> in your
              Railway environment variables and redeploy.
            </p>
          </div>
        </div>
      )}

      {/* Status banner */}
      {status && (
        <div className={`flex items-center gap-3 p-3.5 rounded-xl text-sm font-medium ${
          status.type === "success"
            ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
            : "bg-red-50 border border-red-200 text-red-800"
        }`}>
          {status.type === "success"
            ? <ShieldCheck className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />}
          {status.msg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">

        {/* Buyer verification */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-gray-900 font-semibold text-sm">Buyer Verification Rules</h2>
          <p className="text-gray-500 text-xs -mt-2">
            Invoices will be checked against these values. Leave blank to skip that check.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Expected Buyer Name</label>
            <input
              type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
              placeholder="e.g. Constructora ABC S.A. de C.V."
              {...field("expected_buyer_name")}
            />
            <p className="text-xs text-gray-400 mt-1">Fuzzy-matched (threshold: {form.name_match_threshold}%)</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Expected Buyer Tax ID (RFC / NIT)</label>
            <input
              type="text"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500/30"
              placeholder="e.g. ABC890101XY3"
              {...field("expected_buyer_tax_id")}
            />
            <p className="text-xs text-gray-400 mt-1">Exact match (case-insensitive, ignores spaces and hyphens)</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Expected Buyer Address</label>
            <textarea
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500/30"
              placeholder="e.g. Av. Insurgentes Sur 123, Col. Roma, CDMX"
              {...field("expected_buyer_address")}
            />
            <p className="text-xs text-gray-400 mt-1">Fuzzy token-set match (threshold: {form.address_match_threshold}%)</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Name Match Threshold (%)</label>
              <input
                type="number" min={50} max={100} step={1}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
                {...field("name_match_threshold")}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Address Match Threshold (%)</label>
              <input
                type="number" min={50} max={100} step={1}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
                {...field("address_match_threshold")}
              />
            </div>
          </div>
        </section>

        {/* Downstream matcher */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-gray-900 font-semibold text-sm">Downstream Matcher</h2>
          <p className="text-gray-500 text-xs -mt-2">Approved invoices are forwarded here automatically.</p>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Matcher URL</label>
            <input
              type="url"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
              placeholder="https://anzu-matcher.railway.app/api/v1/ingest"
              {...field("forward_url")}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Matcher API Key</label>
            <input
              type="password"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
              placeholder="Leave blank to keep existing key"
              {...field("forward_api_key")}
            />
          </div>
        </section>

        {/* SAT blacklist */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-gray-900 font-semibold text-sm">SAT Art.69-B EFOS Blacklist</h2>
              <p className="text-gray-500 text-xs mt-1">
                Automatically checked for Mexican invoices (RFC detected). Updated daily.
              </p>
              {satStatus && (
                <p className="text-xs text-gray-400 mt-2">
                  {satStatus.loaded
                    ? `Last downloaded: ${satStatus.downloaded_at ? new Date(satStatus.downloaded_at).toLocaleDateString() : "unknown"} · ${satStatus.row_count?.toLocaleString() ?? "?"} entries`
                    : "Not yet downloaded"}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleSatRefresh}
              disabled={refreshing || connected === false}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh Now
            </button>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || connected === false}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #DC2626, #B91C1C)" }}
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

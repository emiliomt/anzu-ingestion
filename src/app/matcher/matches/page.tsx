"use client";

import { useState, useEffect } from "react";
import {
  Download, Send, Upload, Loader2, Check,
  AlertCircle, FileSpreadsheet, Globe, Key, FileOutput,
} from "lucide-react";

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputCls = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:border-emerald-400";
const selectCls = inputCls;

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({
  icon, title, description, children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3">
        <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="px-5 py-5">{children}</div>
    </div>
  );
}

// ── ERP Config form (shared by API + Upload sections) ─────────────────────────
interface ErpConfig {
  url: string;
  apiKey: string;
  authType: "bearer" | "api_key" | "basic";
}

function ErpConfigFields({
  config,
  onChange,
}: {
  config: ErpConfig;
  onChange: (c: ErpConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          <Globe className="w-3 h-3 inline mr-1" />
          ERP Endpoint URL
        </label>
        <input
          type="url"
          className={inputCls}
          placeholder="https://erp.company.com/api/invoices/import"
          value={config.url}
          onChange={(e) => onChange({ ...config, url: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Auth Type</label>
          <select
            className={selectCls}
            value={config.authType}
            onChange={(e) => onChange({ ...config, authType: e.target.value as ErpConfig["authType"] })}
          >
            <option value="bearer">Bearer Token</option>
            <option value="api_key">X-API-Key</option>
            <option value="basic">Basic (user:pass)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            <Key className="w-3 h-3 inline mr-1" />
            {config.authType === "basic" ? "user:password" : "API Key / Token"}
          </label>
          <input
            type="password"
            className={inputCls}
            placeholder={config.authType === "basic" ? "admin:secret" : "sk-…"}
            value={config.apiKey}
            onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ── Result banner ─────────────────────────────────────────────────────────────
function ResultBanner({ result }: { result: { ok: boolean; message: string } }) {
  return (
    <div className={`mt-3 flex items-start gap-2 text-xs px-3 py-2.5 rounded-lg border ${
      result.ok
        ? "bg-green-50 border-green-200 text-green-700"
        : "bg-red-50 border-red-200 text-red-700"
    }`}>
      {result.ok
        ? <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        : <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />}
      <span>{result.message}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MatchesPage() {
  // ── API push state ─────────────────────────────────────────────────────────
  const [apiConfig, setApiConfig] = useState<ErpConfig>({ url: "", apiKey: "", authType: "bearer" });
  const [apiSending, setApiSending] = useState(false);
  const [apiResult, setApiResult] = useState<{ ok: boolean; message: string } | null>(null);

  // ── Upload state ───────────────────────────────────────────────────────────
  const [uploadConfig, setUploadConfig] = useState<ErpConfig>({ url: "", apiKey: "", authType: "bearer" });
  const [uploadSending, setUploadSending] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ ok: boolean; message: string } | null>(null);

  // ── ERP format download state ──────────────────────────────────────────────
  const [erpProfiles, setErpProfiles] = useState<{ id: string; name: string; outputFormat: string }[]>([]);
  const [selectedErpProfile, setSelectedErpProfile] = useState<string>("sinco");
  const [erpDownloading, setErpDownloading] = useState(false);
  const [erpResult, setErpResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/erp-profiles")
      .then((r) => r.json())
      .then((d: { profiles?: { id: string; name: string; outputFormat: string }[] }) => {
        setErpProfiles(d.profiles ?? []);
      })
      .catch(() => {});
  }, []);

  async function downloadErpFormat() {
    setErpDownloading(true);
    setErpResult(null);
    try {
      const res = await fetch("/api/export/erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter: "confirmed_matches", profileId: selectedErpProfile }),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        setErpResult({ ok: false, message: err.error ?? "Export failed" });
        return;
      }

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

      const label = selectedErpProfile === "sinco"
        ? "SINCO ERP"
        : (erpProfiles.find((p) => p.id === selectedErpProfile)?.name ?? "Custom");
      setErpResult({ ok: true, message: `Downloaded as ${label} format — ${fileName}` });
    } catch (err) {
      setErpResult({ ok: false, message: err instanceof Error ? err.message : "Network error" });
    } finally {
      setErpDownloading(false);
    }
  }

  // ── Send JSON to ERP ───────────────────────────────────────────────────────
  async function sendToErp() {
    if (!apiConfig.url) return;
    setApiSending(true);
    setApiResult(null);
    try {
      const res = await fetch("/api/matching/erp-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...apiConfig, format: "json" }),
      });
      const data = await res.json() as { erpStatus?: number; recordsSent?: number; error?: string };
      if (!res.ok || data.error) {
        setApiResult({ ok: false, message: data.error ?? `Request failed (${res.status})` });
      } else {
        setApiResult({
          ok: data.erpStatus != null && data.erpStatus < 300,
          message: data.erpStatus != null && data.erpStatus < 300
            ? `✓ ${data.recordsSent} records sent — ERP responded ${data.erpStatus}`
            : `ERP returned ${data.erpStatus} — check endpoint configuration`,
        });
      }
    } catch (err) {
      setApiResult({ ok: false, message: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setApiSending(false);
    }
  }

  // ── Upload Excel to ERP ────────────────────────────────────────────────────
  async function uploadToErp() {
    if (!uploadConfig.url) return;
    setUploadSending(true);
    setUploadResult(null);
    try {
      const res = await fetch("/api/matching/erp-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...uploadConfig, format: "xlsx" }),
      });
      const data = await res.json() as { erpStatus?: number; recordsSent?: number; error?: string };
      if (!res.ok || data.error) {
        setUploadResult({ ok: false, message: data.error ?? `Request failed (${res.status})` });
      } else {
        setUploadResult({
          ok: data.erpStatus != null && data.erpStatus < 300,
          message: data.erpStatus != null && data.erpStatus < 300
            ? `✓ Excel file with ${data.recordsSent} records uploaded — ERP responded ${data.erpStatus}`
            : `ERP returned ${data.erpStatus} — check endpoint configuration`,
        });
      }
    } catch (err) {
      setUploadResult({ ok: false, message: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setUploadSending(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Matches</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Export confirmed invoice matches and sync them with your ERP system.
        </p>
      </div>

      <div className="space-y-5">

        {/* ── 1. Download Excel ── */}
        <Section
          icon={<FileSpreadsheet className="w-4 h-4" />}
          title="Export to Excel"
          description="Download all confirmed matches as a spreadsheet ready for ERP upload"
        >
          <p className="text-xs text-gray-500 mb-4">
            Generates an <span className="font-medium text-gray-700">.xlsx</span> file with one row per confirmed match — including invoice details, vendor, match type, PO/Project/Caja Chica reference, and confidence score.
          </p>
          <div className="flex items-center gap-3">
            <a
              href="/api/matching/export"
              download
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Confirmed Matches
            </a>
            <a
              href="/api/matching/export?filter=all"
              download
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download All (incl. pending)
            </a>
          </div>
        </Section>

        {/* ── 2. Download in ERP Format ── */}
        <Section
          icon={<FileOutput className="w-4 h-4" />}
          title="Download in ERP Format"
          description="Export confirmed matches using your configured ERP column mapping"
        >
          <p className="text-xs text-gray-500 mb-4">
            Uses the ERP profiles configured in{" "}
            <span className="font-medium text-gray-700">Settings → ERP Export Settings</span>.
            Exports all confirmed matches in the selected format.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ERP Format</label>
              <select
                className={selectCls}
                value={selectedErpProfile}
                onChange={(e) => { setSelectedErpProfile(e.target.value); setErpResult(null); }}
              >
                <option value="sinco">SINCO ERP (Colombia — CONTABILIDAD · 15 columns)</option>
                {erpProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.outputFormat.toUpperCase()})
                  </option>
                ))}
              </select>
              {erpProfiles.length === 0 && (
                <p className="text-[11px] text-gray-400 mt-1">
                  No custom profiles yet — create them in Settings → ERP Export Settings.
                </p>
              )}
            </div>

            <button
              onClick={downloadErpFormat}
              disabled={erpDownloading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {erpDownloading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                : <><Download className="w-4 h-4" /> Download Confirmed Matches</>}
            </button>
          </div>

          {erpResult && <ResultBanner result={erpResult} />}
        </Section>

        {/* ── 4. Send via API (JSON) ── */}
        <Section
          icon={<Send className="w-4 h-4" />}
          title="Send to ERP via API"
          description="POST confirmed match data as JSON directly to your ERP REST endpoint"
        >
          <ErpConfigFields config={apiConfig} onChange={setApiConfig} />

          <div className="mt-3 bg-gray-50 rounded-lg px-3 py-2 text-[11px] text-gray-500 font-mono">
            POST {"{url}"} · Content-Type: application/json · body: {"{ matches: [...] }"}
          </div>

          <div className="mt-4">
            <button
              onClick={sendToErp}
              disabled={apiSending || !apiConfig.url}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {apiSending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                : <><Send className="w-4 h-4" /> Send to ERP</>}
            </button>
          </div>

          {apiResult && <ResultBanner result={apiResult} />}
        </Section>

        {/* ── 5. Upload Excel to ERP ── */}
        <Section
          icon={<Upload className="w-4 h-4" />}
          title="Upload to ERP"
          description="Generate the Excel file and upload it to your ERP's file import endpoint"
        >
          <ErpConfigFields config={uploadConfig} onChange={setUploadConfig} />

          <div className="mt-3 bg-gray-50 rounded-lg px-3 py-2 text-[11px] text-gray-500 font-mono">
            POST {"{url}"} · multipart/form-data · field: file (anzu-matcher-export.xlsx)
          </div>

          <div className="mt-4">
            <button
              onClick={uploadToErp}
              disabled={uploadSending || !uploadConfig.url}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {uploadSending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                : <><Upload className="w-4 h-4" /> Generate &amp; Upload</>}
            </button>
          </div>

          {uploadResult && <ResultBanner result={uploadResult} />}
        </Section>

      </div>
    </div>
  );
}

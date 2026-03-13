"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus, Pencil, Trash2, ShoppingCart, Loader2, X, Check,
  Upload, Globe, FileSearch, AlertCircle, ChevronDown, ChevronUp,
  CheckSquare, Square,
} from "lucide-react";
import type { PurchaseOrder, Project } from "@/types/invoice";

// ── types ──────────────────────────────────────────────────────────────────

interface ExtractedPO {
  po_number: string | null;
  vendor_name: string | null;
  vendor_tax_id: string | null;
  total_amount: number | null;
  currency: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  description: string | null;
  project_name: string | null;
  payment_terms: string | null;
  line_items: Array<{ description: string; quantity: number | null; unit_price: number | null; line_total: number | null }>;
}

interface ErpPO {
  poNumber: string;
  vendorName: string | null;
  vendorTaxId: string | null;
  totalAmount: number | null;
  currency: string | null;
  issueDate: string | null;
  description: string | null;
  projectName: string | null;
  status: string;
  selected?: boolean;
}

// ── constants ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  open:               "bg-blue-100 text-blue-700",
  partially_matched:  "bg-amber-100 text-amber-700",
  fully_matched:      "bg-green-100 text-green-700",
  closed:             "bg-gray-100 text-gray-600",
};
const STATUS_LABELS: Record<string, string> = {
  open: "Open", partially_matched: "Partial", fully_matched: "Matched", closed: "Closed",
};
const SOURCE_BADGE: Record<string, string> = {
  manual: "bg-gray-100 text-gray-500",
  ocr:    "bg-indigo-100 text-indigo-600",
  erp:    "bg-emerald-100 text-emerald-600",
};

const EMPTY_FORM: Partial<PurchaseOrder & { projectId: string; vendorTaxId: string }> = {
  poNumber: "", vendorName: "", vendorTaxId: "", description: "", currency: "COP", status: "open",
};

type AddMode = "manual" | "ocr" | "erp";

// ── component ──────────────────────────────────────────────────────────────

export default function PurchaseOrdersPage() {
  const [pos, setPos]           = useState<PurchaseOrder[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Add modal
  const [addMode, setAddMode]   = useState<AddMode>("manual");
  const [showAdd, setShowAdd]   = useState(false);

  // Manual / edit form
  const [editing, setEditing]   = useState<PurchaseOrder | null>(null);
  const [form, setForm]         = useState<Partial<PurchaseOrder & { projectId: string; vendorTaxId: string }>>(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);

  // OCR mode
  const [ocrFile, setOcrFile]               = useState<File | null>(null);
  const [extracting, setExtracting]         = useState(false);
  const [extracted, setExtracted]           = useState<ExtractedPO | null>(null);
  const [extractFileUrl, setExtractFileUrl] = useState<string | null>(null);
  const [extractErr, setExtractErr]         = useState<string | null>(null);
  const ocrInputRef = useRef<HTMLInputElement>(null);

  // ERP mode
  const [erpUrl, setErpUrl]           = useState("");
  const [erpKey, setErpKey]           = useState("");
  const [erpAuthType, setErpAuthType] = useState<"bearer"|"api_key"|"basic">("bearer");
  const [erpDataPath, setErpDataPath] = useState("");
  const [erpLoading, setErpLoading]   = useState(false);
  const [erpPOs, setErpPOs]           = useState<ErpPO[]>([]);
  const [erpErr, setErpErr]           = useState<string | null>(null);
  const [erpImporting, setErpImporting] = useState(false);
  const [erpResult, setErpResult]     = useState<{ created: number } | null>(null);

  // ── load ────────────────────────────────────────────────────────────────

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

  // ── helpers ──────────────────────────────────────────────────────────────

  function openCreate(mode: AddMode = "manual") {
    setEditing(null);
    setForm(EMPTY_FORM);
    setExtracted(null);
    setOcrFile(null);
    setExtractErr(null);
    setExtractFileUrl(null);
    setErpPOs([]);
    setErpErr(null);
    setErpResult(null);
    setAddMode(mode);
    setShowAdd(true);
  }

  function openEdit(po: PurchaseOrder) {
    setEditing(po);
    setForm({ ...po, projectId: po.projectId ?? "", vendorTaxId: (po as PurchaseOrder & { vendorTaxId?: string }).vendorTaxId ?? "" });
    setAddMode("manual");
    setShowAdd(true);
  }

  async function saveManual() {
    setSaving(true);
    try {
      const payload = { ...form, projectId: form.projectId || null, source: "manual" };
      if (editing) {
        await fetch(`/api/purchase-orders/${editing.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/purchase-orders", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setShowAdd(false);
      await load();
    } finally { setSaving(false); }
  }

  async function del(id: string) {
    if (!confirm("Delete this PO? This cannot be undone.")) return;
    setDeleting(id);
    await fetch(`/api/purchase-orders/${id}`, { method: "DELETE" });
    setDeleting(null);
    await load();
  }

  // ── OCR extraction ────────────────────────────────────────────────────────

  async function runExtraction(file: File) {
    setExtracting(true);
    setExtracted(null);
    setExtractErr(null);
    setExtractFileUrl(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/purchase-orders/extract", { method: "POST", body: fd });
      let json: { extracted?: ExtractedPO; fileUrl?: string; error?: string };
      try {
        json = await res.json();
      } catch {
        setExtractErr(`Server error (${res.status}): Could not parse response. Check that ANTHROPIC_API_KEY is set.`);
        return;
      }
      if (!res.ok || json.error) { setExtractErr(json.error ?? `Extraction failed (${res.status})`); return; }
      const e = json.extracted!;
      setExtracted(e);
      setExtractFileUrl(json.fileUrl ?? null);
      setForm({
        poNumber:    e.po_number    ?? "",
        vendorName:  e.vendor_name  ?? "",
        vendorTaxId: e.vendor_tax_id ?? "",
        totalAmount: e.total_amount ?? undefined,
        currency:    e.currency     ?? "COP",
        issueDate:   e.issue_date   ?? undefined,
        expiryDate:  e.expiry_date  ?? undefined,
        description: [e.description, e.payment_terms].filter(Boolean).join(" | ") || "",
        status: "open",
      });
    } catch (err) {
      setExtractErr(err instanceof Error ? err.message : "Network error — could not reach extraction API");
    } finally { setExtracting(false); }
  }

  async function saveOcr() {
    setSaving(true);
    try {
      await fetch("/api/purchase-orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, projectId: form.projectId || null, source: "ocr", fileUrl: extractFileUrl }),
      });
      setShowAdd(false);
      await load();
    } finally { setSaving(false); }
  }

  // ── ERP import ────────────────────────────────────────────────────────────

  async function fetchFromErp() {
    if (!erpUrl) return;
    setErpLoading(true);
    setErpPOs([]);
    setErpErr(null);
    setErpResult(null);
    try {
      const res = await fetch("/api/purchase-orders/erp-import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: erpUrl, apiKey: erpKey, authType: erpAuthType, dataPath: erpDataPath }),
      });
      const json = await res.json() as { pos?: ErpPO[]; error?: string };
      if (!res.ok || json.error) { setErpErr(json.error ?? "ERP fetch failed"); return; }
      setErpPOs((json.pos ?? []).map((p) => ({ ...p, selected: true })));
    } finally { setErpLoading(false); }
  }

  async function importSelected() {
    const selected = erpPOs.filter((p) => p.selected);
    if (!selected.length) return;
    setErpImporting(true);
    let created = 0;
    for (const po of selected) {
      try {
        const res = await fetch("/api/purchase-orders", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            poNumber: po.poNumber, vendorName: po.vendorName, vendorTaxId: po.vendorTaxId,
            totalAmount: po.totalAmount, currency: po.currency ?? "COP",
            issueDate: po.issueDate, description: po.description, status: "open", source: "erp",
          }),
        });
        if (res.ok) created++;
      } catch { /* skip duplicates */ }
    }
    setErpResult({ created });
    setErpImporting(false);
    if (created > 0) await load();
  }

  // ── stats ──────────────────────────────────────────────────────────────────

  const totalPOs   = pos.length;
  const openPOs    = pos.filter((p) => p.status === "open").length;
  const matchedPOs = pos.filter((p) => p.status === "fully_matched" || p.status === "partially_matched").length;

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-8">
        <div className="flex-1 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
            <p className="text-sm text-gray-500">Add manually, extract from a PO document, or import from your ERP.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => openCreate("ocr")}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-indigo-200 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors">
            <FileSearch className="w-4 h-4" /> Extract from Document
          </button>
          <button onClick={() => openCreate("erp")}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-emerald-200 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors">
            <Globe className="w-4 h-4" /> Import from ERP
          </button>
          <button onClick={() => openCreate("manual")}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors">
            <Plus className="w-4 h-4" /> New PO
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        {[
          { label: "Total POs", value: totalPOs, color: "text-gray-900", icon: <ShoppingCart className="w-5 h-5 text-blue-500" /> },
          { label: "Open", value: openPOs, color: "text-blue-600", icon: <div className="w-2 h-2 rounded-full bg-blue-500" /> },
          { label: "Matched", value: matchedPOs, color: "text-green-600", icon: <Check className="w-5 h-5 text-green-500" /> },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">{label}</p>
              {icon}
            </div>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Purchase Order Records</h2>
          <p className="text-xs text-gray-400 mt-0.5">Used for AI-powered invoice matching</p>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 py-16 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : pos.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No purchase orders yet</p>
            <p className="text-sm mt-1">Add POs manually, extract from a document, or import from your ERP.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">PO Number</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vendor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Project</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Source</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Matched</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pos.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-mono font-medium text-gray-900">{po.poNumber}</td>
                  <td className="px-4 py-3.5">
                    <p className="text-gray-700">{po.vendorName ?? "—"}</p>
                    {(po as PurchaseOrder & { vendorTaxId?: string }).vendorTaxId && (
                      <p className="text-xs text-gray-400">{(po as PurchaseOrder & { vendorTaxId?: string }).vendorTaxId}</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-gray-500">{po.projectName ?? "—"}</td>
                  <td className="px-4 py-3.5 text-gray-700">
                    {po.totalAmount != null ? `${po.currency} ${po.totalAmount.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[po.status] ?? ""}`}>
                      {STATUS_LABELS[po.status] ?? po.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${SOURCE_BADGE[(po as PurchaseOrder & { source?: string }).source ?? "manual"] ?? SOURCE_BADGE.manual}`}>
                      {(po as PurchaseOrder & { source?: string }).source ?? "manual"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-500">
                    {po._count?.invoiceMatches ?? 0} invoice{(po._count?.invoiceMatches ?? 0) !== 1 ? "s" : ""}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button onClick={() => openEdit(po)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => del(po.id)} disabled={deleting === po.id}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600">
                        {deleting === po.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal ── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="font-semibold text-gray-900">{editing ? "Edit Purchase Order" : "Add Purchase Order"}</h2>
              <button onClick={() => setShowAdd(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Tabs */}
            {!editing && (
              <div className="flex border-b border-gray-100 px-6 flex-shrink-0">
                {([
                  { id: "manual" as AddMode, label: "Manual",                  icon: Plus },
                  { id: "ocr"    as AddMode, label: "Extract from Document",   icon: FileSearch },
                  { id: "erp"    as AddMode, label: "Import from ERP",         icon: Globe },
                ]).map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => setAddMode(id)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                      addMode === id ? "border-emerald-500 text-emerald-600" : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>
            )}

            <div className="overflow-y-auto flex-1 px-6 py-5">

              {/* Manual / edit */}
              {(addMode === "manual" || editing) && (
                <POForm form={form} setForm={setForm} projects={projects} />
              )}

              {/* OCR */}
              {addMode === "ocr" && !editing && (
                <div className="space-y-5">
                  {!extracted && (
                    <label
                      className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-10 cursor-pointer transition-colors ${extracting ? "border-indigo-300 bg-indigo-50" : "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50"}`}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={async (e) => {
                        e.preventDefault(); e.stopPropagation();
                        if (extracting) return;
                        const f = e.dataTransfer.files?.[0];
                        if (f) { setOcrFile(f); await runExtraction(f); }
                      }}
                    >
                      <FileSearch className="w-10 h-10 text-indigo-400 mb-3" />
                      <p className="font-medium text-gray-700">
                        {extracting ? "Extracting with AI…" : "Drop or click to upload a PO document"}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">PDF, PNG, JPG, WEBP — up to 20 MB</p>
                      {extracting && <Loader2 className="w-5 h-5 text-indigo-500 animate-spin mt-3" />}
                      <input ref={ocrInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f) { setOcrFile(f); await runExtraction(f); }
                          if (ocrInputRef.current) ocrInputRef.current.value = "";
                        }}
                        disabled={extracting}
                      />
                    </label>
                  )}
                  {extractErr && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {extractErr}
                    </div>
                  )}
                  {extracted && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-700">
                        <Check className="w-4 h-4 flex-shrink-0" />
                        Extracted from <span className="font-medium">{ocrFile?.name}</span>. Review fields below.
                        <button onClick={() => { setExtracted(null); setOcrFile(null); setForm(EMPTY_FORM); }}
                          className="ml-auto text-indigo-400 hover:text-indigo-600"><X className="w-3.5 h-3.5" /></button>
                      </div>
                      <POForm form={form} setForm={setForm} projects={projects} lineItems={extracted.line_items} />
                    </div>
                  )}
                </div>
              )}

              {/* ERP */}
              {addMode === "erp" && !editing && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">ERP Endpoint URL *</label>
                      <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        placeholder="https://erp.company.com/api/purchase-orders"
                        value={erpUrl} onChange={(e) => setErpUrl(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">API Key / Token</label>
                      <input type="password" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        placeholder="sk-…" value={erpKey} onChange={(e) => setErpKey(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Auth Type</label>
                      <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        value={erpAuthType} onChange={(e) => setErpAuthType(e.target.value as "bearer"|"api_key"|"basic")}>
                        <option value="bearer">Bearer Token</option>
                        <option value="api_key">X-API-Key Header</option>
                        <option value="basic">Basic Auth</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        JSON Data Path <span className="text-gray-400">(e.g. <code className="bg-gray-100 px-1 rounded">data.items</code> — leave blank if root is array)</span>
                      </label>
                      <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        placeholder="data.purchaseOrders" value={erpDataPath} onChange={(e) => setErpDataPath(e.target.value)} />
                    </div>
                  </div>
                  <button onClick={fetchFromErp} disabled={!erpUrl || erpLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    {erpLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Fetching…</> : <><Globe className="w-4 h-4" /> Fetch POs</>}
                  </button>
                  {erpErr && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {erpErr}
                    </div>
                  )}
                  {erpResult && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                      <Check className="w-4 h-4 inline mr-1" /> {erpResult.created} PO(s) imported successfully.
                    </div>
                  )}
                  {erpPOs.length > 0 && !erpResult && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <p className="font-medium text-gray-700">{erpPOs.filter(p=>p.selected).length} of {erpPOs.length} selected</p>
                        <div className="flex gap-2 text-gray-400">
                          <button className="hover:text-gray-600" onClick={() => setErpPOs(p=>p.map(x=>({...x,selected:true})))}>All</button>
                          <span>·</span>
                          <button className="hover:text-gray-600" onClick={() => setErpPOs(p=>p.map(x=>({...x,selected:false})))}>None</button>
                        </div>
                      </div>
                      <div className="border border-gray-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                            <tr>
                              <th className="w-8 px-3 py-2" />
                              <th className="text-left px-3 py-2 font-medium text-gray-600">PO Number</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-600">Vendor</th>
                              <th className="text-right px-3 py-2 font-medium text-gray-600">Amount</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-600">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {erpPOs.map((po, i) => (
                              <tr key={i} className={`cursor-pointer hover:bg-gray-50 ${po.selected ? "" : "opacity-40"}`}
                                onClick={() => setErpPOs(p=>p.map((x,j)=>j===i?{...x,selected:!x.selected}:x))}>
                                <td className="px-3 py-2">
                                  {po.selected ? <CheckSquare className="w-3.5 h-3.5 text-emerald-500" /> : <Square className="w-3.5 h-3.5 text-gray-300" />}
                                </td>
                                <td className="px-3 py-2 font-mono font-medium text-gray-800">{po.poNumber}</td>
                                <td className="px-3 py-2 text-gray-600">{po.vendorName ?? "—"}</td>
                                <td className="px-3 py-2 text-right text-gray-600">
                                  {po.totalAmount != null ? `${po.currency ?? ""} ${po.totalAmount.toLocaleString()}` : "—"}
                                </td>
                                <td className="px-3 py-2 text-gray-500">{po.issueDate ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              {(addMode === "manual" || editing) && (
                <button onClick={saveManual} disabled={saving || !form.poNumber?.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {editing ? "Save Changes" : "Create PO"}
                </button>
              )}
              {addMode === "ocr" && !editing && extracted && (
                <button onClick={saveOcr} disabled={saving || !form.poNumber?.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save Extracted PO
                </button>
              )}
              {addMode === "erp" && !editing && erpPOs.length > 0 && !erpResult && (
                <button onClick={importSelected} disabled={erpImporting || !erpPOs.some(p=>p.selected)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                  {erpImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Import {erpPOs.filter(p=>p.selected).length} PO(s)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared PO form ──────────────────────────────────────────────────────────

type POFormValues = Partial<PurchaseOrder & { projectId: string; vendorTaxId: string }>;

function POForm({
  form, setForm, projects, lineItems,
}: {
  form: POFormValues;
  setForm: React.Dispatch<React.SetStateAction<POFormValues>>;
  projects: Project[];
  lineItems?: ExtractedPO["line_items"];
}) {
  const [showLineItems, setShowLineItems] = useState(false);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">PO Number *</label>
          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-400"
            value={form.poNumber ?? ""} onChange={(e) => setForm((f)=>({...f,poNumber:e.target.value}))} placeholder="OC-2025-001" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Vendor Name</label>
          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            value={form.vendorName ?? ""} onChange={(e) => setForm((f)=>({...f,vendorName:e.target.value}))} placeholder="Proveedor S.A.S." />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Vendor NIT / Tax ID</label>
          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            value={form.vendorTaxId ?? ""} onChange={(e) => setForm((f)=>({...f,vendorTaxId:e.target.value}))} placeholder="900123456-7" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Project</label>
          <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            value={form.projectId ?? ""} onChange={(e) => setForm((f)=>({...f,projectId:e.target.value}))}>
            <option value="">— None —</option>
            {projects.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            value={form.status ?? "open"} onChange={(e) => setForm((f)=>({...f,status:e.target.value as PurchaseOrder["status"]}))}>
            <option value="open">Open</option>
            <option value="partially_matched">Partially Matched</option>
            <option value="fully_matched">Fully Matched</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Total Amount</label>
          <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            value={form.totalAmount ?? ""} onChange={(e) => setForm((f)=>({...f,totalAmount:e.target.value?Number(e.target.value):undefined}))} placeholder="0" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
          <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            value={form.currency ?? "COP"} onChange={(e) => setForm((f)=>({...f,currency:e.target.value}))}>
            {["COP","USD","MXN","ARS","BRL","PEN","CLP","EUR"].map((c)=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Issue Date</label>
          <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            value={form.issueDate ? String(form.issueDate).slice(0,10) : ""} onChange={(e) => setForm((f)=>({...f,issueDate:e.target.value||undefined}))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Expiry Date</label>
          <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            value={form.expiryDate ? String(form.expiryDate).slice(0,10) : ""} onChange={(e) => setForm((f)=>({...f,expiryDate:e.target.value||undefined}))} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
          <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
            rows={2} value={form.description ?? ""} onChange={(e) => setForm((f)=>({...f,description:e.target.value}))}
            placeholder="What does this PO cover?" />
        </div>
      </div>

      {/* Extracted line items (collapsible) */}
      {lineItems && lineItems.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <button onClick={() => setShowLineItems((v)=>!v)}
            className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 transition-colors">
            <span>Extracted Line Items ({lineItems.length})</span>
            {showLineItems ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showLineItems && (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-t border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Description</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">Qty</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">Unit Price</th>
                  <th className="text-right px-4 py-2 font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lineItems.map((item, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-gray-700">{item.description}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{item.quantity ?? "—"}</td>
                    <td className="px-4 py-2 text-right text-gray-500">{item.unit_price?.toLocaleString() ?? "—"}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{item.line_total?.toLocaleString() ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

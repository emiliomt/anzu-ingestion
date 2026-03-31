"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  FileOutput, Plus, Trash2, GripVertical, Save, Loader2,
  Upload, CheckCircle, AlertCircle, Pencil, X, ChevronDown, ChevronUp,
} from "lucide-react";

// ── Anzu internal field options ────────────────────────────────────────────────

export const ANZU_FIELDS: { value: string; label: string }[] = [
  { value: "invoice_number",   label: "Invoice Number" },
  { value: "vendor_name",      label: "Vendor Name" },
  { value: "vendor_nit",       label: "Vendor NIT / Tax ID" },
  { value: "invoice_date",     label: "Invoice Date" },
  { value: "due_date",         label: "Due Date" },
  { value: "total_amount",     label: "Total Amount" },
  { value: "tax_amount",       label: "Tax Amount (IVA)" },
  { value: "tax_base",         label: "Tax Base (Subtotal)" },
  { value: "line_description", label: "Line Item Description" },
  { value: "account_code",     label: "Account Code" },
  { value: "debit_amount",     label: "Debit Amount" },
  { value: "credit_amount",    label: "Credit Amount" },
  { value: "cost_center",      label: "Cost Center" },
  { value: "document_type",    label: "Document Type" },
  { value: "consecutive",      label: "Consecutive" },
  { value: "reference",        label: "Reference No" },
  { value: "segment",          label: "Segment" },
];

// SINCO preset column documentation
const SINCO_COLUMNS = [
  { col: "dTipoDocumento", desc: 'Document type code (e.g. "FC" for factura de compra)' },
  { col: "dConsecutivo",   desc: "Invoice consecutive / sequence number" },
  { col: "dTercero",       desc: "Vendor NIT or supplier code" },
  { col: "dDescripcion",   desc: "Invoice description / vendor name" },
  { col: "dFecha",         desc: "Invoice date (YYYY-MM-DD)" },
  { col: "dVencimiento",   desc: "Due date (YYYY-MM-DD)" },
  { col: "dReferencia",    desc: "Invoice reference number" },
  { col: "mCuenta",        desc: "Accounting account code (PUC)" },
  { col: "mDebito",        desc: "Debit amount (numeric)" },
  { col: "mCredito",       desc: "Credit amount (numeric)" },
  { col: "mDescripcion",   desc: "Line item description" },
  { col: "mNit",           desc: "Third-party NIT for the accounting line" },
  { col: "mBase",          desc: "Tax base amount" },
  { col: "mCentroC",       desc: "Cost centre code" },
  { col: "mSegmento",      desc: "Segment code" },
];

// ── Types ──────────────────────────────────────────────────────────────────────

interface ColumnRow {
  id: string; // local key for React
  header: string;
  anzuField: string | null;
}

interface ErpProfile {
  id: string;
  name: string;
  erpType: string;
  columnMapping: string; // JSON
  outputFormat: string;
  createdAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const selectClass =
  "w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400";
const inputClass =
  "w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400";

let idCounter = 0;
function uid() { return `col_${++idCounter}_${Math.random().toString(36).slice(2, 7)}`; }

// ── Sub-component: column mapping table ───────────────────────────────────────

function ColumnMappingTable({
  rows,
  onChange,
}: {
  rows: ColumnRow[];
  onChange: (rows: ColumnRow[]) => void;
}) {
  const addRow = () => {
    onChange([...rows, { id: uid(), header: "", anzuField: null }]);
  };

  const updateRow = (id: string, patch: Partial<ColumnRow>) => {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    onChange(rows.filter((r) => r.id !== id));
  };

  // drag-to-reorder
  const dragIdx = useRef<number | null>(null);

  const onDragStart = (i: number) => { dragIdx.current = i; };
  const onDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === i) return;
    const next = [...rows];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(i, 0, moved);
    dragIdx.current = i;
    onChange(next);
  };
  const onDragEnd = () => { dragIdx.current = null; };

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="grid grid-cols-[24px_1fr_1fr_32px] gap-2 px-2 mb-1">
        <div />
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Output column header</span>
        <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Maps to Anzu field</span>
        <div />
      </div>

      {rows.map((row, i) => (
        <div
          key={row.id}
          draggable
          onDragStart={() => onDragStart(i)}
          onDragOver={(e) => onDragOver(e, i)}
          onDragEnd={onDragEnd}
          className="grid grid-cols-[24px_1fr_1fr_32px] gap-2 items-center px-2 py-1 rounded-lg hover:bg-gray-50 group"
        >
          <GripVertical className="w-4 h-4 text-gray-300 cursor-grab group-hover:text-gray-400" />
          <input
            type="text"
            value={row.header}
            onChange={(e) => updateRow(row.id, { header: e.target.value })}
            placeholder="Column name..."
            className={inputClass}
          />
          <select
            value={row.anzuField ?? ""}
            onChange={(e) => updateRow(row.id, { anzuField: e.target.value || null })}
            className={selectClass}
          >
            <option value="">(leave unmapped)</option>
            {ANZU_FIELDS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <button
            onClick={() => removeRow(row.id)}
            className="p-1 hover:bg-red-50 rounded text-gray-300 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <button
        onClick={addRow}
        className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 px-2 py-1.5 hover:bg-indigo-50 rounded-lg transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add column
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ErpExportSettingsSection() {
  const [mode, setMode] = useState<"sinco" | "custom_upload" | "custom_manual">("sinco");

  // Template upload state
  const [uploadedHeaders, setUploadedHeaders] = useState<string[]>([]);
  const [uploadedFormat, setUploadedFormat] = useState<"csv" | "xlsx">("xlsx");
  const [uploadedRows, setUploadedRows] = useState<ColumnRow[]>([]);
  const [uploadParsing, setUploadParsing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Manual mapping state
  const [manualRows, setManualRows] = useState<ColumnRow[]>([]);

  // Profile save state
  const [profileName, setProfileName] = useState("");
  const [outputFormat, setOutputFormat] = useState<"xlsx" | "csv">("xlsx");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Saved profiles
  const [profiles, setProfiles] = useState<ErpProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit mode
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    try {
      const res = await fetch("/api/erp-profiles");
      const data = await res.json() as { profiles: ErpProfile[] };
      setProfiles(data.profiles ?? []);
    } catch {
      // ignore
    } finally {
      setLoadingProfiles(false);
    }
  }, []);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  // ── Template file upload ─────────────────────────────────────────────────────
  const handleTemplateUpload = async (file: File) => {
    setUploadParsing(true);
    setUploadError(null);
    setUploadedHeaders([]);
    setUploadedRows([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/erp-profiles/parse-template", {
        method: "POST",
        body: formData,
      });
      const data = await res.json() as { headers?: string[]; detectedFormat?: "csv" | "xlsx"; error?: string };

      if (!res.ok || data.error) {
        setUploadError(data.error ?? "Failed to parse file");
        return;
      }

      const headers = data.headers ?? [];
      setUploadedHeaders(headers);
      setUploadedFormat(data.detectedFormat ?? "xlsx");
      setUploadedRows(headers.map((h) => ({ id: uid(), header: h, anzuField: null })));
    } catch {
      setUploadError("Network error while parsing file");
    } finally {
      setUploadParsing(false);
    }
  };

  // ── Save profile ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const rows = mode === "custom_upload" ? uploadedRows : manualRows;
    const format = mode === "custom_upload" ? uploadedFormat : outputFormat;

    if (!profileName.trim()) {
      setSaveMsg({ ok: false, text: "Please enter a profile name" });
      return;
    }
    if (rows.length === 0) {
      setSaveMsg({ ok: false, text: "Please define at least one column" });
      return;
    }

    setSaving(true);
    setSaveMsg(null);

    const columnMapping = rows.map(({ header, anzuField }) => ({ header, anzuField }));
    const url = editingId ? `/api/erp-profiles/${editingId}` : "/api/erp-profiles";
    const method = editingId ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileName.trim(), columnMapping, outputFormat: format }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setSaveMsg({ ok: false, text: data.error ?? "Save failed" });
      } else {
        setSaveMsg({ ok: true, text: editingId ? "Profile updated!" : "Profile saved!" });
        setProfileName("");
        setEditingId(null);
        if (mode === "custom_upload") { setUploadedRows([]); setUploadedHeaders([]); }
        if (mode === "custom_manual") { setManualRows([]); }
        loadProfiles();
      }
    } catch {
      setSaveMsg({ ok: false, text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  // ── Load profile into editor ──────────────────────────────────────────────────
  const loadIntoEditor = (p: ErpProfile) => {
    const mapping = JSON.parse(p.columnMapping) as { header: string; anzuField: string | null }[];
    const rows: ColumnRow[] = mapping.map((c) => ({ id: uid(), header: c.header, anzuField: c.anzuField }));
    setMode("custom_manual");
    setManualRows(rows);
    setProfileName(p.name);
    setOutputFormat(p.outputFormat === "csv" ? "csv" : "xlsx");
    setEditingId(p.id);
    setSaveMsg(null);
  };

  // ── Delete profile ────────────────────────────────────────────────────────────
  const deleteProfile = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/erp-profiles/${id}`, { method: "DELETE" });
      loadProfiles();
      if (editingId === id) { setEditingId(null); setProfileName(""); setManualRows([]); }
    } finally {
      setDeletingId(null);
    }
  };

  // ── Drop zone for template upload ─────────────────────────────────────────────
  const [dragover, setDragover] = useState(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragover(false);
    const file = e.dataTransfer.files[0];
    if (file) handleTemplateUpload(file);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-5">
      {/* Mode selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-700">Select ERP / Export Format</label>
        <select
          value={mode}
          onChange={(e) => {
            setMode(e.target.value as typeof mode);
            setEditingId(null);
            setSaveMsg(null);
          }}
          className={selectClass}
        >
          <option value="sinco">SINCO ERP (Colombia — preconfigured)</option>
          <option value="custom_upload">Custom (upload template)</option>
          <option value="custom_manual">Custom (manual mapping)</option>
        </select>
      </div>

      {/* ── SINCO panel ──────────────────────────────────────────────────────── */}
      {mode === "sinco" && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-indigo-600 flex-shrink-0" />
            <span className="text-xs font-semibold text-indigo-800">
              SINCO ERP — preconfigured for Colombia
            </span>
          </div>
          <p className="text-xs text-indigo-700 leading-relaxed">
            No configuration needed. Selecting invoices and clicking{" "}
            <strong>Export to ERP</strong> will generate an <code>.xlsx</code> file
            with a single sheet named <strong>CONTABILIDAD</strong> containing these
            15 columns:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-indigo-600 font-semibold border-b border-indigo-200">
                  <th className="text-left py-1 pr-4">Column</th>
                  <th className="text-left py-1">Description</th>
                </tr>
              </thead>
              <tbody>
                {SINCO_COLUMNS.map(({ col, desc }) => (
                  <tr key={col} className="border-b border-indigo-100 last:border-0">
                    <td className="py-1 pr-4 font-mono text-indigo-700 whitespace-nowrap">{col}</td>
                    <td className="py-1 text-indigo-800">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-indigo-600">
            File will be named: <code>SINCO_export_YYYYMMDD_HHMMSS.xlsx</code>
          </p>
        </div>
      )}

      {/* ── Upload template panel ─────────────────────────────────────────────── */}
      {mode === "custom_upload" && (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
              dragover
                ? "border-indigo-400 bg-indigo-50"
                : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
            onDragLeave={() => setDragover(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
            <p className="text-xs text-gray-600 font-medium">
              Drop a CSV or XLSX file here, or click to browse
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              Only the header row is used — data rows are ignored
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleTemplateUpload(f);
                e.target.value = "";
              }}
            />
          </div>

          {uploadParsing && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Parsing file headers...
            </div>
          )}

          {uploadError && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {uploadError}
            </div>
          )}

          {/* Mapping table after upload */}
          {uploadedHeaders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs font-medium text-gray-700">
                  Detected {uploadedHeaders.length} column{uploadedHeaders.length !== 1 ? "s" : ""} —{" "}
                  map each to an Anzu field below
                </span>
              </div>
              <ColumnMappingTable rows={uploadedRows} onChange={setUploadedRows} />
            </div>
          )}

          {/* Save form */}
          {uploadedHeaders.length > 0 && (
            <SaveProfileForm
              name={profileName}
              onNameChange={setProfileName}
              outputFormat={uploadedFormat}
              showFormatPicker={false}
              saving={saving}
              saveMsg={saveMsg}
              isEditing={!!editingId}
              onSave={handleSave}
              onCancelEdit={() => { setEditingId(null); setProfileName(""); setSaveMsg(null); }}
            />
          )}
        </div>
      )}

      {/* ── Manual mapping panel ──────────────────────────────────────────────── */}
      {mode === "custom_manual" && (
        <div className="space-y-4">
          <ColumnMappingTable rows={manualRows} onChange={setManualRows} />

          <SaveProfileForm
            name={profileName}
            onNameChange={setProfileName}
            outputFormat={outputFormat}
            showFormatPicker
            onFormatChange={setOutputFormat}
            saving={saving}
            saveMsg={saveMsg}
            isEditing={!!editingId}
            onSave={handleSave}
            onCancelEdit={() => { setEditingId(null); setProfileName(""); setSaveMsg(null); setManualRows([]); }}
          />
        </div>
      )}

      {/* ── Saved profiles list ───────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">Saved Custom Profiles</span>
          {loadingProfiles && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
        </div>

        {profiles.length === 0 && !loadingProfiles && (
          <p className="text-xs text-gray-400 py-2">
            No custom profiles yet. Create one above.
          </p>
        )}

        {profiles.map((p) => {
          const mapping = JSON.parse(p.columnMapping) as { header: string; anzuField: string | null }[];
          const isExpanded = expandedId === p.id;

          return (
            <div
              key={p.id}
              className="border border-gray-100 rounded-lg overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3 py-2.5 bg-white">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-gray-800">{p.name}</span>
                  <span className="ml-2 text-[10px] text-gray-400 uppercase tracking-wide">
                    {p.outputFormat}
                  </span>
                  <span className="ml-2 text-[11px] text-gray-400">
                    · {mapping.length} column{mapping.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  className="p-1 hover:bg-gray-100 rounded text-gray-400"
                  title={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded
                    ? <ChevronUp className="w-3.5 h-3.5" />
                    : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => loadIntoEditor(p)}
                  className="p-1 hover:bg-indigo-50 rounded text-gray-400 hover:text-indigo-600"
                  title="Edit profile"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => deleteProfile(p.id)}
                  disabled={deletingId === p.id}
                  className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 disabled:opacity-50"
                  title="Delete profile"
                >
                  {deletingId === p.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {mapping.map((col, i) => (
                      <div key={i} className="flex items-center gap-1.5 py-0.5">
                        <span className="text-[11px] font-medium text-gray-700 truncate w-32">{col.header}</span>
                        <span className="text-[10px] text-gray-400">→</span>
                        <span className="text-[11px] text-indigo-600 truncate">
                          {col.anzuField
                            ? ANZU_FIELDS.find((f) => f.value === col.anzuField)?.label ?? col.anzuField
                            : <span className="text-gray-400">(unmapped)</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Save profile form sub-component ───────────────────────────────────────────

function SaveProfileForm({
  name,
  onNameChange,
  outputFormat,
  showFormatPicker,
  onFormatChange,
  saving,
  saveMsg,
  isEditing,
  onSave,
  onCancelEdit,
}: {
  name: string;
  onNameChange: (v: string) => void;
  outputFormat: string;
  showFormatPicker: boolean;
  onFormatChange?: (v: "xlsx" | "csv") => void;
  saving: boolean;
  saveMsg: { ok: boolean; text: string } | null;
  isEditing: boolean;
  onSave: () => void;
  onCancelEdit: () => void;
}) {
  return (
    <div className="border border-gray-100 rounded-lg p-4 space-y-3 bg-gray-50">
      <span className="text-xs font-semibold text-gray-700">
        {isEditing ? "Edit Profile" : "Save as Profile"}
      </span>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder='Profile name (e.g. "SAP B1 - Empresa X")'
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
          />
        </div>

        {showFormatPicker && onFormatChange && (
          <select
            value={outputFormat}
            onChange={(e) => onFormatChange(e.target.value as "xlsx" | "csv")}
            className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 w-24"
          >
            <option value="xlsx">XLSX</option>
            <option value="csv">CSV</option>
          </select>
        )}

        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1.5 text-xs px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors whitespace-nowrap"
        >
          {saving
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Save className="w-3.5 h-3.5" />}
          {isEditing ? "Update Profile" : "Save Profile"}
        </button>

        {isEditing && (
          <button
            onClick={onCancelEdit}
            className="flex items-center gap-1.5 text-xs px-3 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        )}
      </div>

      {saveMsg && (
        <div
          className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
            saveMsg.ok
              ? "bg-green-50 border border-green-100 text-green-700"
              : "bg-red-50 border border-red-100 text-red-700"
          }`}
        >
          {saveMsg.ok
            ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
            : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
          {saveMsg.text}
        </div>
      )}
    </div>
  );
}

// ── Section wrapper for use in admin/settings ──────────────────────────────────

export function ErpExportSectionIcon() {
  return <FileOutput className="w-4 h-4" />;
}

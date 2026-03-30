"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Cpu, Webhook, FileType, Info,
  Copy, Check, Zap, FileText, Image,
  Settings2, Save, Loader2, SlidersHorizontal,
  Plus, Trash2, ToggleLeft, ToggleRight,
} from "lucide-react";
import { COUNTRY_CURRENCY, ALL_EXTRACTION_FIELDS } from "@/lib/app-settings";
import type { AppSettings } from "@/lib/app-settings";

// ── Copy-to-clipboard helper ──────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={copy}
      className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
      title="Copy"
    >
      {copied
        ? <Check className="w-3.5 h-3.5 text-green-500" />
        : <Copy className="w-3.5 h-3.5 text-gray-400" />
      }
    </button>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-start gap-3">
        <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          {icon}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ── Row inside a section ───────────────────────────────────────────────────────
function Row({
  label,
  value,
  mono = false,
  copyable = false,
  badge,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
  badge?: { text: string; color: string };
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500 w-40 flex-shrink-0">{label}</span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className={`text-xs text-gray-800 truncate ${mono ? "font-mono" : ""}`}>
          {value}
        </span>
        {badge && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${badge.color}`}>
            {badge.text}
          </span>
        )}
      </div>
      {copyable && <CopyButton text={value} />}
    </div>
  );
}

// ── Pipeline step card ─────────────────────────────────────────────────────────
function PipelineStep({
  step,
  icon,
  title,
  subtitle,
  tag,
  tagColor,
  arrow = true,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tag: string;
  tagColor: string;
  arrow?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
        <div className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 flex items-start gap-2.5">
          <div className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
            {step}
          </div>
          <div className="text-indigo-600 flex-shrink-0 mt-0.5">{icon}</div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-800">{title}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{subtitle}</div>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tagColor}`}>
          {tag}
        </span>
      </div>
      {arrow && <div className="text-gray-300 text-sm flex-shrink-0">→</div>}
    </div>
  );
}

// ── Form field helpers ────────────────────────────────────────────────────────
function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-gray-50 last:border-0 gap-4">
      <div className="flex-shrink-0 w-52">
        <div className="text-xs font-medium text-gray-700">{label}</div>
        {hint && <div className="text-[11px] text-gray-400 mt-0.5">{hint}</div>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

const selectClass = "w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400";
const inputClass = "w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 font-mono";

// Country list derived from COUNTRY_CURRENCY
const COUNTRY_NAMES: Record<string, string> = {
  CO: "Colombia", MX: "México", AR: "Argentina", CL: "Chile", PE: "Perú",
  BO: "Bolivia", PY: "Paraguay", UY: "Uruguay", VE: "Venezuela", EC: "Ecuador",
  PA: "Panamá", CR: "Costa Rica", DO: "República Dominicana", GT: "Guatemala",
  HN: "Honduras", SV: "El Salvador", NI: "Nicaragua", CU: "Cuba",
  US: "United States", CA: "Canada",
  GB: "United Kingdom",
  ES: "España", FR: "France", DE: "Germany", IT: "Italy", PT: "Portugal",
  NL: "Netherlands", BE: "Belgium", AT: "Austria", CH: "Switzerland",
  BR: "Brasil",
  CN: "China", JP: "Japan", KR: "South Korea", IN: "India",
  AU: "Australia", NZ: "New Zealand",
};

// ── Field selection config ────────────────────────────────────────────────────

type FieldGroup = {
  label: string;
  color: string;
  fields: { key: string; label: string }[];
};

const FIELD_GROUPS: FieldGroup[] = [
  {
    label: "Core",
    color: "bg-blue-50 text-blue-700 border-blue-100",
    fields: [
      { key: "vendor_name",    label: "Vendor Name" },
      { key: "vendor_address", label: "Vendor Address" },
      { key: "invoice_number", label: "Invoice Number" },
      { key: "issue_date",     label: "Issue Date" },
      { key: "due_date",       label: "Due Date" },
      { key: "subtotal",       label: "Subtotal" },
      { key: "tax",            label: "Tax (IVA/VAT)" },
      { key: "total",          label: "Total Amount" },
      { key: "currency",       label: "Currency" },
    ],
  },
  {
    label: "Financial",
    color: "bg-emerald-50 text-emerald-700 border-emerald-100",
    fields: [
      { key: "po_reference",  label: "PO Reference" },
      { key: "payment_terms", label: "Payment Terms" },
      { key: "bank_details",  label: "Bank Details" },
    ],
  },
  {
    label: "Vendor",
    color: "bg-purple-50 text-purple-700 border-purple-100",
    fields: [
      { key: "vendor_tax_id", label: "Vendor Tax ID (NIT/RFC/CUIT)" },
    ],
  },
  {
    label: "Buyer",
    color: "bg-orange-50 text-orange-700 border-orange-100",
    fields: [
      { key: "buyer_name",    label: "Buyer Name" },
      { key: "buyer_tax_id",  label: "Buyer Tax ID" },
      { key: "buyer_address", label: "Buyer Address" },
    ],
  },
  {
    label: "Project",
    color: "bg-teal-50 text-teal-700 border-teal-100",
    fields: [
      { key: "concept",         label: "Concept / Subject" },
      { key: "project_name",    label: "Project Name" },
      { key: "project_address", label: "Project Address" },
      { key: "project_city",    label: "Project City" },
    ],
  },
  {
    label: "Other",
    color: "bg-gray-50 text-gray-700 border-gray-100",
    fields: [
      { key: "notes",      label: "Notes / Observations" },
      { key: "line_items", label: "Line Items" },
    ],
  },
];

const ALL_FIELD_KEYS = ALL_EXTRACTION_FIELDS as unknown as string[];

// ── Custom field type ─────────────────────────────────────────────────────────
interface CustomFieldRecord {
  id: string;
  name: string;
  key: string;
  prompt: string | null;
  fieldType: string;
  isActive: boolean;
  includeInExport: boolean;
  displayOrder: number;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : ""
  );

  const emailWebhook    = `${origin}/api/webhooks/email`;
  const whatsappWebhook = `${origin}/api/webhooks/whatsapp`;
  const uploadEndpoint  = `${origin}/api/upload`;

  // ── Settings state ──────────────────────────────────────────────────────────
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Custom fields state ─────────────────────────────────────────────────────
  const [customFields, setCustomFields] = useState<CustomFieldRecord[]>([]);
  const [newField, setNewField] = useState({ name: "", key: "", prompt: "", fieldType: "text" });
  const [addingField, setAddingField] = useState(false);
  const [cfSaving, setCfSaving] = useState(false);

  useEffect(() => {
    fetch("/api/custom-fields")
      .then((r) => r.json())
      .then((d) => setCustomFields(d.fields ?? []))
      .catch(() => {});
  }, []);

  function autoKey(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }

  async function handleAddField(e: React.FormEvent) {
    e.preventDefault();
    setCfSaving(true);
    try {
      const res = await fetch("/api/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newField),
      });
      if (res.ok) {
        const { field } = await res.json();
        setCustomFields((prev) => [...prev, field]);
        setNewField({ name: "", key: "", prompt: "", fieldType: "text" });
        setAddingField(false);
      }
    } finally {
      setCfSaving(false);
    }
  }

  async function toggleFieldActive(field: CustomFieldRecord) {
    const res = await fetch(`/api/custom-fields/${field.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !field.isActive }),
    });
    if (res.ok) {
      const { field: updated } = await res.json();
      setCustomFields((prev) => prev.map((f) => f.id === updated.id ? updated : f));
    }
  }

  async function toggleFieldExport(field: CustomFieldRecord) {
    const res = await fetch(`/api/custom-fields/${field.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeInExport: !field.includeInExport }),
    });
    if (res.ok) {
      const { field: updated } = await res.json();
      setCustomFields((prev) => prev.map((f) => f.id === updated.id ? updated : f));
    }
  }

  async function deleteField(id: string) {
    if (!confirm("Delete this custom field? Existing extracted values will remain in the database.")) return;
    await fetch(`/api/custom-fields/${id}`, { method: "DELETE" });
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  }

  // Fetch current settings on mount
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setDraft(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load settings.");
        setLoading(false);
      });
  }, []);

  // When country changes, auto-update currency
  const setDraftField = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev, [key]: value };
      // Auto-derive currency when country changes
      if (key === "default_country" && typeof value === "string") {
        next.default_currency = COUNTRY_CURRENCY[value] ?? prev.default_currency;
      }
      return next;
    });
  }, []);

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          auto_approve_threshold: draft.auto_approve_threshold ?? "null",
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const updated: AppSettings = await res.json();
      setSettings(updated);
      setDraft(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(settings);

  return (
    <>
      {/* Top bar */}
      <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0 pl-16 lg:pl-6">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Settings</h1>
          <p className="text-xs text-gray-400">Pipeline configuration and integration details</p>
        </div>

        {draft && (
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors
              disabled:opacity-50
              bg-indigo-600 text-white hover:bg-indigo-700 disabled:hover:bg-indigo-600"
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : saved
                ? <Check className="w-4 h-4" />
                : <Save className="w-4 h-4" />
            }
            {saving ? "Saving…" : saved ? "Saved!" : "Save changes"}
          </button>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* Error banner */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Success banner */}
          {saved && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg px-4 py-3 flex items-center gap-2">
              <Check className="w-3.5 h-3.5" />
              Settings saved successfully.
            </div>
          )}

          {/* ── Regional Settings ── */}
          <Section
            icon={<Settings2 className="w-4 h-4" />}
            title="Regional &amp; Language"
            description="Default locale context used when documents don't specify these values"
          >
            {loading || !draft ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-4">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading settings…
              </div>
            ) : (
              <>
                <FieldRow label="Default Country" hint="ISO 3166-1 alpha-2 country code">
                  <select
                    className={selectClass}
                    value={draft.default_country}
                    onChange={(e) => setDraftField("default_country", e.target.value)}
                  >
                    {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
                      <option key={code} value={code}>{name} ({code})</option>
                    ))}
                  </select>
                </FieldRow>

                <FieldRow label="Default Currency" hint="ISO 4217 — auto-derived from country, or override">
                  <select
                    className={selectClass}
                    value={draft.default_currency}
                    onChange={(e) => setDraftField("default_currency", e.target.value)}
                  >
                    {Array.from(new Set(Object.values(COUNTRY_CURRENCY))).sort().map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </FieldRow>

                <FieldRow label="Document Language" hint="Affects OCR cleaning heuristics and AI prompt tuning">
                  <select
                    className={selectClass}
                    value={draft.document_language}
                    onChange={(e) => setDraftField("document_language", e.target.value)}
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="es">Spanish (Español)</option>
                    <option value="en">English</option>
                    <option value="pt">Portuguese (Português)</option>
                  </select>
                </FieldRow>

                <FieldRow label="Amount Format" hint="Number grouping convention used in documents">
                  <select
                    className={selectClass}
                    value={draft.amount_format}
                    onChange={(e) => setDraftField("amount_format", e.target.value)}
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="latin_american">Latin American (1.234.567,89)</option>
                    <option value="us">US / International (1,234,567.89)</option>
                  </select>
                </FieldRow>
              </>
            )}
          </Section>

          {/* ── Extraction Behaviour ── */}
          <Section
            icon={<Cpu className="w-4 h-4" />}
            title="Extraction Behaviour"
            description="Control AI confidence thresholds, timeouts and auto-approval logic"
          >
            {loading || !draft ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-4">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading settings…
              </div>
            ) : (
              <>
                <FieldRow
                  label="Low Confidence Threshold"
                  hint={`Fields below ${Math.round((draft.low_confidence_threshold ?? 0.85) * 100)}% confidence get flagged`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={50} max={95} step={5}
                      value={Math.round((draft.low_confidence_threshold ?? 0.85) * 100)}
                      onChange={(e) => setDraftField("low_confidence_threshold", parseInt(e.target.value, 10) / 100)}
                      className="flex-1 accent-indigo-600"
                    />
                    <span className="text-xs font-mono text-gray-700 w-10 text-right">
                      {Math.round((draft.low_confidence_threshold ?? 0.85) * 100)}%
                    </span>
                  </div>
                </FieldRow>

                <FieldRow label="Extraction Timeout" hint="GPT-4o-mini API call timeout (10–90 seconds)">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={10} max={90} step={5}
                      value={draft.extraction_timeout_seconds ?? 45}
                      onChange={(e) => setDraftField("extraction_timeout_seconds", parseInt(e.target.value, 10))}
                      className={`${inputClass} w-24`}
                    />
                    <span className="text-xs text-gray-400">seconds</span>
                  </div>
                </FieldRow>

                <FieldRow
                  label="Auto-Approve Threshold"
                  hint="If all core fields ≥ this score, status is set to 'reviewed' automatically. Leave blank to disable."
                >
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.auto_approve_threshold !== null}
                        onChange={(e) =>
                          setDraftField(
                            "auto_approve_threshold",
                            e.target.checked ? 0.95 : null
                          )
                        }
                        className="w-3.5 h-3.5 accent-indigo-600"
                      />
                      <span className="text-xs text-gray-600">Enabled</span>
                    </label>
                    {draft.auto_approve_threshold !== null && (
                      <>
                        <input
                          type="range"
                          min={80} max={99} step={1}
                          value={Math.round((draft.auto_approve_threshold ?? 0.95) * 100)}
                          onChange={(e) => setDraftField("auto_approve_threshold", parseInt(e.target.value, 10) / 100)}
                          className="flex-1 accent-indigo-600"
                        />
                        <span className="text-xs font-mono text-gray-700 w-10 text-right">
                          {Math.round((draft.auto_approve_threshold ?? 0.95) * 100)}%
                        </span>
                      </>
                    )}
                  </div>
                </FieldRow>

                <FieldRow label="Flag Duplicates" hint="Detect and flag invoices with the same reference number">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.flag_duplicates ?? true}
                      onChange={(e) => setDraftField("flag_duplicates", e.target.checked)}
                      className="w-3.5 h-3.5 accent-indigo-600"
                    />
                    <span className="text-xs text-gray-600">
                      {draft.flag_duplicates ? "Enabled — duplicates are flagged" : "Disabled"}
                    </span>
                  </label>
                </FieldRow>
              </>
            )}
          </Section>

          {/* ── Fields to Extract ── */}
          <Section
            icon={<SlidersHorizontal className="w-4 h-4" />}
            title="Fields to Extract"
            description="Choose which fields the OCR extractor will capture from each invoice"
          >
            {loading || !draft ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-4">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading settings…
              </div>
            ) : (
              <>
                {/* Select all / deselect all */}
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-50">
                  <span className="text-xs text-gray-500">
                    {(draft.extraction_fields ?? ALL_FIELD_KEYS).length} / {ALL_FIELD_KEYS.length} fields selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDraftField("extraction_fields", [...ALL_FIELD_KEYS])}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Select all
                    </button>
                    <span className="text-gray-300">·</span>
                    <button
                      type="button"
                      onClick={() => setDraftField("extraction_fields", [])}
                      className="text-[11px] text-gray-400 hover:text-gray-600 font-medium"
                    >
                      Clear all
                    </button>
                  </div>
                </div>

                {/* Field groups */}
                <div className="space-y-4">
                  {FIELD_GROUPS.map((group) => {
                    const activeFields = draft.extraction_fields ?? ALL_FIELD_KEYS;
                    const allChecked = group.fields.every((f) => activeFields.includes(f.key));
                    const someChecked = group.fields.some((f) => activeFields.includes(f.key));

                    function toggleGroup(checked: boolean) {
                      const keys = group.fields.map((f) => f.key);
                      const next = checked
                        ? Array.from(new Set([...activeFields, ...keys]))
                        : activeFields.filter((k) => !keys.includes(k));
                      setDraftField("extraction_fields", next);
                    }

                    function toggleField(key: string, checked: boolean) {
                      const next = checked
                        ? Array.from(new Set([...activeFields, key]))
                        : activeFields.filter((k) => k !== key);
                      setDraftField("extraction_fields", next);
                    }

                    return (
                      <div key={group.label}>
                        {/* Group header */}
                        <label className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer mb-1.5 ${group.color}`}>
                          <input
                            type="checkbox"
                            checked={allChecked}
                            ref={(el) => { if (el) el.indeterminate = !allChecked && someChecked; }}
                            onChange={(e) => toggleGroup(e.target.checked)}
                            className="w-3 h-3 accent-indigo-600"
                          />
                          {group.label}
                        </label>
                        {/* Fields */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 pl-2">
                          {group.fields.map(({ key, label }) => (
                            <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={activeFields.includes(key)}
                                onChange={(e) => toggleField(key, e.target.checked)}
                                className="w-3 h-3 accent-indigo-600 flex-shrink-0"
                              />
                              <span className="text-xs text-gray-700 truncate">{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[11px] text-gray-400 mt-3">
                  Deselecting a field excludes it from the AI prompt, which can reduce cost and improve accuracy for fields that don&apos;t appear in your documents.
                </p>
              </>
            )}
          </Section>

          {/* ── Extraction Pipeline ── */}
          <Section
            icon={<Zap className="w-4 h-4" />}
            title="Extraction Pipeline"
            description="How incoming invoices are processed based on file type"
          >
            {/* XML path */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-3.5 h-3.5 text-green-600" />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  XML invoices (DIAN / UBL)
                </span>
                <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                  No AI cost
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <PipelineStep
                  step={1} icon={<FileText className="w-3 h-3" />}
                  title="XML received" subtitle="text/xml · application/xml"
                  tag="Input" tagColor="bg-blue-50 text-blue-700"
                />
                <PipelineStep
                  step={2} icon={<Zap className="w-3 h-3" />}
                  title="parseInvoiceXML()" subtitle="CDATA unwrap · NIT parse · UBL fields"
                  tag="Deterministic" tagColor="bg-green-50 text-green-700"
                  arrow={false}
                />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Image className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Images &amp; PDFs
                </span>
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium">
                  Two-pass AI
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <PipelineStep
                  step={1} icon={<Image className="w-3 h-3" />}
                  title="GPT-4o Vision" subtitle="OCR — raw text extraction"
                  tag="gpt-4o" tagColor="bg-indigo-50 text-indigo-700"
                />
                <PipelineStep
                  step={2} icon={<Zap className="w-3 h-3" />}
                  title="OCR Cleaner" subtitle="8-step: fix chars · dates · numbers · markers"
                  tag="Deterministic" tagColor="bg-green-50 text-green-700"
                />
                <PipelineStep
                  step={3} icon={<Cpu className="w-3 h-3" />}
                  title="GPT-4o-mini" subtitle={`Structured extraction · ${draft?.extraction_timeout_seconds ?? 25}s timeout`}
                  tag="gpt-4o-mini" tagColor="bg-purple-50 text-purple-700"
                  arrow={false}
                />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-xs">
                <div className="font-semibold text-gray-600 mb-1">OCR Model</div>
                <div className="font-mono text-gray-800">gpt-4o</div>
                <div className="text-gray-400 mt-0.5">Vision, 2 048 tokens max</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-xs">
                <div className="font-semibold text-gray-600 mb-1">Extraction Model</div>
                <div className="font-mono text-gray-800">gpt-4o-mini</div>
                <div className="text-gray-400 mt-0.5">
                  Text, 1 500 tokens, {draft?.extraction_timeout_seconds ?? 25}s timeout
                </div>
              </div>
            </div>
          </Section>

          {/* ── Custom Extraction Fields ── */}
          <Section
            icon={<SlidersHorizontal className="w-4 h-4" />}
            title="Custom Extraction Fields"
            description="User-defined fields the AI extracts from every invoice. Active fields appear in CSV and ERP exports."
          >
            {customFields.length === 0 && !addingField ? (
              <p className="text-xs text-gray-400 py-2">No custom fields yet. Add one to extract additional data from invoices.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {customFields.map((cf) => (
                  <div key={cf.id} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-800">{cf.name}</span>
                        <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{cf.key}</span>
                        <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">{cf.fieldType}</span>
                      </div>
                      {cf.prompt && (
                        <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-sm">{cf.prompt}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => toggleFieldActive(cf)}
                        title={cf.isActive ? "Disable" : "Enable"}
                        className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${cf.isActive ? "bg-green-50 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
                      >
                        {cf.isActive ? <ToggleRight className="w-3.5 h-3.5 inline" /> : <ToggleLeft className="w-3.5 h-3.5 inline" />}
                        {" "}{cf.isActive ? "On" : "Off"}
                      </button>
                      <button
                        onClick={() => toggleFieldExport(cf)}
                        title={cf.includeInExport ? "Remove from export" : "Include in export"}
                        className={`text-[10px] px-2 py-1 rounded-md font-medium transition-colors ${cf.includeInExport ? "bg-blue-50 text-blue-600 hover:bg-blue-100" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
                      >
                        CSV {cf.includeInExport ? "✓" : "✗"}
                      </button>
                      <button
                        onClick={() => deleteField(cf.id)}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {addingField ? (
              <form onSubmit={handleAddField} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-medium text-gray-600 block mb-1">Display Name *</label>
                    <input
                      className={inputClass}
                      placeholder="Cost Center"
                      value={newField.name}
                      onChange={(e) => setNewField((p) => ({ ...p, name: e.target.value, key: autoKey(e.target.value) }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-gray-600 block mb-1">AI Key *</label>
                    <input
                      className={inputClass}
                      placeholder="cost_center"
                      value={newField.key}
                      onChange={(e) => setNewField((p) => ({ ...p, key: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-600 block mb-1">AI Extraction Prompt</label>
                  <input
                    className={inputClass}
                    placeholder='Extract the cost center code, e.g. "CC-201"'
                    value={newField.prompt}
                    onChange={(e) => setNewField((p) => ({ ...p, prompt: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-600 block mb-1">Field Type</label>
                  <select
                    className={selectClass}
                    value={newField.fieldType}
                    onChange={(e) => setNewField((p) => ({ ...p, fieldType: e.target.value }))}
                  >
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date (YYYY-MM-DD)</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={cfSaving}
                    className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                  >
                    {cfSaving ? "Saving…" : "Add Field"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingField(false)}
                    className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setAddingField(true)}
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add custom field
              </button>
            )}
          </Section>

          {/* ── Webhooks & Endpoints ── */}
          <Section
            icon={<Webhook className="w-4 h-4" />}
            title="Webhooks &amp; Endpoints"
            description="Integration URLs for external systems and intake channels"
          >
            <Row label="Web Upload"       value={uploadEndpoint}  mono copyable />
            <Row label="Email Webhook"    value={emailWebhook}    mono copyable
              badge={{ text: "SendGrid Inbound Parse", color: "bg-orange-50 text-orange-700" }}
            />
            <Row label="WhatsApp Webhook" value={whatsappWebhook} mono copyable
              badge={{ text: "Twilio", color: "bg-green-50 text-green-700" }}
            />
            <Row label="Status Lookup"    value={`${origin}/status/{referenceNo}`} mono copyable />
            <Row label="Invoice API"      value={`${origin}/api/invoices`} mono copyable />
            <Row label="Export CSV"       value={`${origin}/api/export`}   mono copyable />
          </Section>

          {/* ── Accepted File Types ── */}
          <Section
            icon={<FileType className="w-4 h-4" />}
            title="Accepted File Types"
            description="MIME types accepted by the upload endpoint"
          >
            <div className="flex flex-wrap gap-2">
              {[
                { label: "PDF",               mime: "application/pdf",  color: "bg-red-50 text-red-700" },
                { label: "JPEG",              mime: "image/jpeg",       color: "bg-sky-50 text-sky-700" },
                { label: "PNG",               mime: "image/png",        color: "bg-sky-50 text-sky-700" },
                { label: "WebP",              mime: "image/webp",       color: "bg-sky-50 text-sky-700" },
                { label: "HEIC",              mime: "image/heic",       color: "bg-sky-50 text-sky-700" },
                { label: "TIFF",              mime: "image/tiff",       color: "bg-sky-50 text-sky-700" },
                { label: "XML (UBL/DIAN)",    mime: "text/xml",         color: "bg-green-50 text-green-700" },
                { label: "XML (application)", mime: "application/xml",  color: "bg-green-50 text-green-700" },
              ].map(({ label, mime, color }) => (
                <div key={mime} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${color}`}>
                  <div>{label}</div>
                  <div className="font-mono opacity-60 text-[10px] mt-0.5">{mime}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── About ── */}
          <Section
            icon={<Info className="w-4 h-4" />}
            title="About"
            description="Application identifiers and format conventions"
          >
            <Row label="App name"           value="AnzuIngestion" />
            <Row label="Reference format"   value="AZ-YYYY-XXXXXX" mono />
            <Row label="Default currency"   value={draft ? `${draft.default_currency} (configurable above)` : "COP"} />
            <Row label="Date format stored" value="YYYY-MM-DD (ISO 8601)" mono />
            <Row label="Storage"            value="Local filesystem · ./uploads/ (switchable to S3)" />
            <Row label="Database"           value="PostgreSQL (Railway) · SQLite (local dev)" />
            <Row label="Intake channels"    value="Web · Email (SendGrid) · WhatsApp (Twilio)" />
          </Section>

        </div>
      </div>
    </>
  );
}

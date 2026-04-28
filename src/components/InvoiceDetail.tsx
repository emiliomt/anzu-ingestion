"use client";

import { useState, useEffect } from "react";
import {
  X, ExternalLink, CheckCircle, Edit2, Save, AlertTriangle,
  FileText, Calendar, DollarSign, Hash, Clock, Sparkles, Loader2, GitMerge,
  BookMarked, Trash2, RotateCcw,
} from "lucide-react";
import { StatusBadge, ChannelBadge } from "./StatusBadge";
import type { InvoiceDetail as InvoiceDetailType, ExtractedFieldData } from "@/types/invoice";
import { saveGroundTruth } from "@/app/admin/invoices/[id]/actions";
import { format } from "date-fns";

interface InvoiceDetailProps {
  invoiceId: string;
  onClose: () => void;
  onStatusChange?: () => void;
  onDeleted?: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  vendor_name: "Vendor Name",
  vendor_address: "Vendor Address",
  invoice_number: "Invoice Number",
  issue_date: "Issue Date",
  due_date: "Due Date",
  subtotal: "Subtotal",
  tax: "Tax",
  total: "Total",
  currency: "Currency",
  po_reference: "PO Reference",
  payment_terms: "Payment Terms",
  bank_details: "Bank Details",
};

const FIELD_ICONS: Record<string, React.ReactNode> = {
  vendor_name: <FileText className="w-3.5 h-3.5" />,
  invoice_number: <Hash className="w-3.5 h-3.5" />,
  issue_date: <Calendar className="w-3.5 h-3.5" />,
  due_date: <Clock className="w-3.5 h-3.5" />,
  total: <DollarSign className="w-3.5 h-3.5" />,
};

export function InvoiceDetail({ invoiceId, onClose, onStatusChange, onDeleted }: InvoiceDetailProps) {
  const [invoice, setInvoice] = useState<InvoiceDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [classifyError, setClassifyError] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState(false);
  const [savingGT, setSavingGT] = useState(false);
  const [gtToast, setGtToast] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [matchLabel, setMatchLabel] = useState<string | null>(null);
  const [matchConfirmed, setMatchConfirmed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // Load match status
    fetch(`/api/matching/list?filter=all`)
      .then((r) => r.json() as Promise<{ id: string; match: { matchLabel: string; isConfirmed: boolean } | null }[]>)
      .then((rows) => {
        const row = rows.find((r) => r.id === invoiceId);
        if (row?.match) {
          setMatchLabel(row.match.matchLabel);
          setMatchConfirmed(row.match.isConfirmed);
        }
      })
      .catch(() => {});
  }, [invoiceId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/invoices/${invoiceId}`);
        const data = await res.json() as InvoiceDetailType;
        if (!cancelled) {
          setInvoice(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [invoiceId]);

  const handleSaveField = async (field: ExtractedFieldData) => {
    setSaving(true);
    try {
      await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldId: field.id,
          fieldName: field.fieldName,
          value: editValue,
          reviewedBy: "admin",
        }),
      });

      setInvoice((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          extractedData: prev.extractedData.map((f) =>
            f.id === field.id ? { ...f, value: editValue, isVerified: true } : f
          ),
        };
      });
      setEditingField(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, reviewedBy: "admin" }),
      });
      setInvoice((prev) => prev ? { ...prev, status: newStatus as InvoiceDetailType["status"] } : prev);
      onStatusChange?.();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveGroundTruth = async () => {
    setSavingGT(true);
    setGtToast(null);
    try {
      const result = await saveGroundTruth(invoiceId);
      if (result.success) {
        setGtToast({
          type: "success",
          text: `Ground truth saved (${result.fieldCount} fields) — fineTuneStatus: READY`,
        });
        // Reflect the new fineTuneStatus in the audit trail without a full reload
        setInvoice((prev) =>
          prev
            ? {
                ...prev,
                events: [
                  {
                    id: crypto.randomUUID(),
                    eventType: "ground_truth_saved",
                    timestamp: new Date().toISOString(),
                    metadata: { fieldCount: result.fieldCount, by: "admin" },
                  },
                  ...prev.events,
                ],
              }
            : prev
        );
      } else {
        setGtToast({ type: "error", text: result.error ?? "Unknown error" });
      }
    } catch (err) {
      console.error("[saveGroundTruth]", err);
      setGtToast({ type: "error", text: "Request failed" });
    } finally {
      setSavingGT(false);
      // Auto-dismiss after 4 s
      setTimeout(() => setGtToast(null), 4000);
    }
  };

  const handleClassify = async () => {
    setClassifying(true);
    setClassifyError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/classify`, { method: "POST" });
      const data = await res.json() as {
        error?: string;
        lineItems?: InvoiceDetailType["lineItems"];
        updatedCount?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "Classify request failed");
      if (!Array.isArray(data.lineItems)) throw new Error("Classifier returned an invalid response");

      setInvoice((prev) => prev ? { ...prev, lineItems: data.lineItems ?? prev.lineItems } : prev);
    } catch (err) {
      console.error("[Classify]", err);
      setClassifyError(err instanceof Error ? err.message : "Classification failed");
    } finally {
      setClassifying(false);
    }
  };

  const handleRerunExtraction = async () => {
    setRerunning(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/rerun`, { method: "POST" });
      const payload = await res.json().catch(() => ({} as { error?: string; message?: string }));
      if (!res.ok) {
        throw new Error(payload.error ?? "Re-run extraction failed");
      }
      // Mark as processing in UI immediately; user can refresh or wait for list poll.
      setInvoice((prev) => prev ? { ...prev, status: "processing" } : prev);
      setGtToast({
        type: "success",
        text: payload.message ?? "Extraction re-run queued.",
      });
      onStatusChange?.();
    } catch (err) {
      setGtToast({
        type: "error",
        text: err instanceof Error ? err.message : "Re-run extraction failed",
      });
    } finally {
      setRerunning(false);
      setTimeout(() => setGtToast(null), 4000);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      onDeleted?.();
      onClose();
    } catch (err) {
      console.error(err);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        Failed to load invoice
      </div>
    );
  }

  const flags = invoice.flags;
  const hasLowConf = invoice.extractedData.some(
    (f) => f.confidence !== null && f.confidence < 0.85
  );

  return (
    <div className="relative flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-sm font-bold text-indigo-700">
              {invoice.referenceNo}
            </span>
            <ChannelBadge channel={invoice.channel} />
            <StatusBadge status={invoice.status} />
            {matchLabel && (
              <a
                href="/matcher/matching?filter=confirmed"
                title="View in Matcher"
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  matchConfirmed
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                <GitMerge className="w-3 h-3" />
                {matchConfirmed ? matchLabel : `Pending: ${matchLabel}`}
              </a>
            )}
          </div>
          <p className="text-xs text-gray-400">
            {invoice.vendorName ?? invoice.fileName} ·{" "}
            {format(new Date(invoice.submittedAt), "MMM d, yyyy HH:mm")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete invoice"
              className="p-1.5 hover:bg-red-50 rounded-lg transition-colors group"
            >
              <Trash2 className="w-4 h-4 text-gray-300 group-hover:text-red-500 transition-colors" />
            </button>
          ) : (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
              <span className="text-xs text-red-700 font-medium">Delete?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? "…" : "Yes"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-2 py-0.5 border border-red-200 text-red-600 rounded hover:bg-red-100 transition-colors"
              >
                No
              </button>
            </div>
          )}
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Alerts */}
      {(flags.length > 0 || invoice.isDuplicate || hasLowConf) && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex flex-wrap gap-2 items-center">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          {invoice.isDuplicate && (
            <span className="text-xs text-amber-700 font-medium">Possible duplicate</span>
          )}
          {hasLowConf && (
            <span className="text-xs text-amber-700 font-medium">Low confidence fields</span>
          )}
          {flags.filter((f) => f !== "duplicate" && f !== "low_confidence").map((f) => (
            <span key={f} className="text-xs text-amber-700 font-medium">
              {f.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Left: File preview */}
        <div className="w-1/2 border-r border-gray-100 overflow-hidden flex flex-col">
          <div className="p-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Original File</span>
            <a
              href={invoice.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
            >
              Open <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex-1 overflow-auto bg-gray-100">
            {invoice.mimeType === "application/pdf" ? (
              <iframe
                src={invoice.fileUrl}
                className="w-full h-full"
                title="Invoice PDF"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={invoice.fileUrl}
                alt="Invoice"
                className="max-w-full object-contain mx-auto p-4"
              />
            )}
          </div>
        </div>

        {/* Right: Extracted data */}
        <div className="w-1/2 overflow-auto">
          <div className="p-4 space-y-4">
            {/* Status actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">Change status:</span>
              {["reviewed", "complete", "error"].map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                    invoice.status === s
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-medium"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}

              {/* ── Ground-truth capture ── */}
              <div className="h-4 w-px bg-gray-200 mx-1" aria-hidden />
              <button
                onClick={handleRerunExtraction}
                disabled={rerunning}
                title="Re-run OCR + extraction for this invoice"
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 disabled:opacity-50 transition-colors"
              >
                {rerunning
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <RotateCcw className="w-3 h-3" />}
                {rerunning ? "Re-running…" : "Re-run extraction"}
              </button>
              <button
                onClick={handleSaveGroundTruth}
                disabled={savingGT}
                title="Snapshot current field values as verified ground truth for AI fine-tuning (sets fineTuneStatus = READY)"
                className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
              >
                {savingGT
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <BookMarked className="w-3 h-3" />}
                {savingGT ? "Saving…" : "Save Ground Truth"}
              </button>
            </div>

            {/* Extracted fields */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Extracted Fields
              </h4>
              <div className="space-y-2">
                {invoice.extractedData.map((field) => {
                  const isEditing = editingField === field.id;
                  const confColor = confidenceColor(field.confidence);

                  return (
                    <div
                      key={field.id}
                      className={`group rounded-lg p-3 border transition-colors ${
                        field.confidence !== null && field.confidence < 0.85
                          ? "border-amber-200 bg-amber-50"
                          : field.isVerified
                          ? "border-green-100 bg-green-50"
                          : "border-gray-100 bg-gray-50 hover:border-gray-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400">
                            {FIELD_ICONS[field.fieldName]}
                          </span>
                          <span className="text-xs font-medium text-gray-500">
                            {FIELD_LABELS[field.fieldName] ?? field.fieldName}
                          </span>
                          {field.isVerified && (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${confColor}`}>
                            {confidenceLabel(field.confidence)}
                          </span>
                          {!isEditing && (
                            <button
                              onClick={() => {
                                setEditingField(field.id);
                                setEditValue(field.value ?? "");
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded transition-all"
                            >
                              <Edit2 className="w-3 h-3 text-gray-500" />
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="input text-xs py-1 flex-1"
                          />
                          <button
                            onClick={() => handleSaveField(field)}
                            disabled={saving}
                            className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                          >
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingField(null)}
                            className="p-1.5 border border-gray-200 rounded hover:bg-gray-100"
                          >
                            <X className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-800">
                          {field.value ?? <span className="text-gray-300 italic">Not found</span>}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Line items — header + classify button always visible */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Line Items
                  {invoice.lineItems.length > 0 && (
                    <span className="ml-1.5 font-normal normal-case text-gray-400">
                      ({invoice.lineItems.length})
                    </span>
                  )}
                </h4>
                <button
                  onClick={handleClassify}
                  disabled={classifying}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                  title="Use AI to classify line items using the invoice concept as context"
                >
                  {classifying
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Sparkles className="w-3 h-3" />}
                  {classifying ? "Classifying…" : "Classify with AI"}
                </button>
              </div>

              {invoice.lineItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left p-2 text-gray-500 font-medium">Description</th>
                        <th className="text-left p-2 text-gray-500 font-medium">Category</th>
                        <th className="text-right p-2 text-gray-500 font-medium">Qty</th>
                        <th className="text-right p-2 text-gray-500 font-medium">Unit Price</th>
                        <th className="text-right p-2 text-gray-500 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {invoice.lineItems.map((li) => (
                        <tr key={li.id} className="bg-white">
                          <td className="p-2 text-gray-700">{li.description ?? "—"}</td>
                          <td className="p-2">
                            {li.category
                              ? <CategoryBadge category={li.category} />
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="p-2 text-right text-gray-700">{li.quantity ?? "—"}</td>
                          <td className="p-2 text-right text-gray-700">
                            {li.unitPrice != null ? li.unitPrice.toFixed(2) : "—"}
                          </td>
                          <td className="p-2 text-right font-medium text-gray-800">
                            {li.lineTotal != null ? li.lineTotal.toFixed(2) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">
                  No line items extracted yet. Click &ldquo;Classify with AI&rdquo; to run AI classification.
                </p>
              )}
              {classifyError && (
                <p className="mt-2 text-xs text-red-600">{classifyError}</p>
              )}
            </div>

            {/* Event timeline */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Audit Trail
              </h4>
              <div className="space-y-2">
                {invoice.events.map((event) => (
                  <div key={event.id} className="flex items-start gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-gray-700">
                        {event.eventType.replace(/_/g, " ")}
                      </span>
                      <span className="text-gray-400 ml-2">
                        {format(new Date(event.timestamp), "MMM d, HH:mm:ss")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Ground-truth toast */}
      {gtToast && (
        <div
          className={`absolute bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-xs font-medium border ${
            gtToast.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {gtToast.type === "success"
            ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            : <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
          {gtToast.text}
        </div>
      )}
    </div>
  );
}

function confidenceLabel(score: number | null): string {
  if (score === null) return "—";
  if (score >= 0.95) return "High";
  if (score >= 0.85) return "Medium";
  return "Low";
}

const CATEGORY_STYLES: Record<string, string> = {
  material:  "bg-blue-50 text-blue-700 border-blue-200",
  labor:     "bg-green-50 text-green-700 border-green-200",
  equipment: "bg-orange-50 text-orange-700 border-orange-200",
  freight:   "bg-purple-50 text-purple-700 border-purple-200",
  overhead:  "bg-gray-100 text-gray-600 border-gray-200",
  tax:       "bg-red-50 text-red-700 border-red-200",
  discount:  "bg-teal-50 text-teal-700 border-teal-200",
  other:     "bg-gray-50 text-gray-500 border-gray-200",
};

function CategoryBadge({ category }: { category: string }) {
  const cls = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.other;
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium uppercase tracking-wide ${cls}`}>
      {category}
    </span>
  );
}

function confidenceColor(score: number | null): string {
  if (score === null) return "text-gray-400";
  if (score >= 0.95) return "text-green-600";
  if (score >= 0.85) return "text-yellow-600";
  return "text-red-600";
}


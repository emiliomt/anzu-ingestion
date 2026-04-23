"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BrainCircuit, Download, Play, RefreshCw,
  CheckCircle2, XCircle, Loader2, AlertCircle, Cpu,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface JobStatus {
  jobId: string | null;
  status: "running" | "succeeded" | "failed" | null;
  openaiStatus: string | null;
  fineTunedModelId: string | null;
  trainedTokens: number | null;
  error: string | null;
}

interface ModelConfig {
  id: "extractor" | "vat" | "po";
  label: string;
  suffix: string;
  description: string;
  exportUrl: string;
  finetuneUrl: string;
  statusUrl: string;
  trainingSource: string;
}

// ── Model definitions ──────────────────────────────────────────────────────

const MODELS: ModelConfig[] = [
  {
    id: "extractor",
    label: "Invoice Data Extraction",
    suffix: "anzu-invoice-extractor-v1",
    description: "Extracts structured fields (vendor, totals, line items) from raw OCR text.",
    exportUrl: "/api/training/export",
    finetuneUrl: "/api/training/finetune",
    statusUrl: "/api/training/status",
    trainingSource: "Invoices with human-corrected fields",
  },
  {
    id: "vat",
    label: "Line-Item VAT Classification",
    suffix: "anzu-vat-classifier-v1",
    description: "Classifies each line item into material, labor, equipment, freight, overhead, tax, discount, or other.",
    exportUrl: "/api/vat-classifier/export",
    finetuneUrl: "/api/vat-classifier/finetune",
    statusUrl: "/api/vat-classifier/status",
    trainingSource: "Invoices with AI/admin-classified line items",
  },
  {
    id: "po",
    label: "Invoice-to-PO Matching",
    suffix: "anzu-po-matcher-v1",
    description: "Matches invoices to Projects, Purchase Orders, or Caja Chica based on invoice fields and context.",
    exportUrl: "/api/po-matcher/export",
    finetuneUrl: "/api/po-matcher/finetune",
    statusUrl: "/api/po-matcher/status",
    trainingSource: "Confirmed invoice matches (approved or manually confirmed)",
  },
];

// ── Status badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-gray-400">Not started</span>;
  const map: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    running: {
      color: "bg-blue-50 text-blue-700 border-blue-200",
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
      label: "Training…",
    },
    succeeded: {
      color: "bg-green-50 text-green-700 border-green-200",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      label: "Ready",
    },
    failed: {
      color: "bg-red-50 text-red-700 border-red-200",
      icon: <XCircle className="w-3.5 h-3.5" />,
      label: "Failed",
    },
  };
  const cfg = map[status] ?? {
    color: "bg-gray-100 text-gray-600 border-gray-200",
    icon: null,
    label: status,
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cfg.color}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ── Model card ─────────────────────────────────────────────────────────────

function ModelCard({ model }: { model: ModelConfig }) {
  const [jobStatus, setJobStatus] = useState<JobStatus>({
    jobId: null,
    status: null,
    openaiStatus: null,
    fineTunedModelId: null,
    trainedTokens: null,
    error: null,
  });
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(model.statusUrl);
      const data: JobStatus = await res.json();
      setJobStatus(data);
    } catch {
      // silently ignore on initial load
    } finally {
      setLoading(false);
    }
  }, [model.statusUrl]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-poll while running
  useEffect(() => {
    if (jobStatus.status !== "running") return;
    const interval = setInterval(async () => {
      setPolling(true);
      await fetchStatus();
      setPolling(false);
    }, 30_000);
    return () => clearInterval(interval);
  }, [jobStatus.status, fetchStatus]);

  const handleExport = () => {
    window.open(model.exportUrl, "_blank");
  };

  const handleCheckStatus = async () => {
    setPolling(true);
    setCardError(null);
    await fetchStatus();
    setPolling(false);
  };

  const handleStartFineTune = async () => {
    setCardError(null);
    setStarting(true);
    try {
      const res = await fetch(model.finetuneUrl, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setCardError(data.error ?? "Failed to start fine-tuning job");
      } else {
        setJobStatus((prev) => ({
          ...prev,
          jobId: data.jobId,
          status: "running",
          openaiStatus: "queued",
        }));
      }
    } catch {
      setCardError("Network error starting fine-tuning job");
    } finally {
      setStarting(false);
    }
  };

  const isRunning = jobStatus.status === "running";

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-2 bg-indigo-50 rounded-lg">
            <Cpu className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{model.label}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{model.description}</p>
          </div>
        </div>
        {loading ? (
          <Loader2 className="w-4 h-4 text-gray-300 animate-spin flex-shrink-0" />
        ) : (
          <StatusBadge status={jobStatus.status} />
        )}
      </div>

      {/* Training source */}
      <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
        <BrainCircuit className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        <span>
          <span className="font-medium text-gray-700">Training data: </span>
          {model.trainingSource}
        </span>
      </div>

      {/* Active model */}
      {jobStatus.fineTunedModelId && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs">
          <span className="font-semibold text-green-700">Active model: </span>
          <code className="text-green-800 break-all">{jobStatus.fineTunedModelId}</code>
        </div>
      )}

      {/* Job details */}
      {jobStatus.jobId && (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs space-y-1">
          <div>
            <span className="text-blue-700 font-semibold">Job ID: </span>
            <code className="text-blue-800 break-all">{jobStatus.jobId}</code>
          </div>
          {jobStatus.openaiStatus && (
            <div>
              <span className="text-blue-700 font-semibold">OpenAI status: </span>
              {jobStatus.openaiStatus}
            </div>
          )}
          {jobStatus.trainedTokens != null && (
            <div>
              <span className="text-blue-700 font-semibold">Tokens trained: </span>
              {jobStatus.trainedTokens.toLocaleString()}
            </div>
          )}
          {jobStatus.error && (
            <div className="text-red-600 mt-1">{jobStatus.error}</div>
          )}
        </div>
      )}

      {/* Suffix badge */}
      <div className="text-xs text-gray-400">
        Suffix:{" "}
        <code className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
          {model.suffix}
        </code>
        {" · "}
        Base model:{" "}
        <code className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
          gpt-4.1-mini
        </code>
      </div>

      {/* Error */}
      {cardError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          {cardError}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs hover:bg-gray-50 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export JSONL
        </button>

        <button
          onClick={handleCheckStatus}
          disabled={polling || !jobStatus.jobId}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {polling ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Check status
        </button>

        <button
          onClick={handleStartFineTune}
          disabled={isRunning || starting}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {starting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          {isRunning ? "Training…" : "Start fine-tuning"}
        </button>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ModelsPage() {
  return (
    <>
      <header className="h-16 bg-white border-b border-gray-100 flex items-center px-6 flex-shrink-0 pl-16 lg:pl-6">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Fine-Tuned Models</h1>
          <p className="text-xs text-gray-400">
            Manage all three Anzu fine-tuning jobs — export training data, launch jobs, and track status
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Info banner */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-xs text-indigo-800 leading-relaxed">
          <span className="font-semibold text-indigo-900">How it works: </span>
          Each model is fine-tuned on a different signal from your production data. Export the JSONL
          to preview or audit, then start a fine-tuning job directly from here. Jobs run asynchronously
          on OpenAI (15–60 min). Once succeeded, wire the model ID into the corresponding lib file or
          settings key so Anzu uses it automatically.
        </div>

        {/* Model cards */}
        <div className="grid grid-cols-1 gap-4">
          {MODELS.map((model) => (
            <ModelCard key={model.id} model={model} />
          ))}
        </div>

        {/* Footer */}
        <p className="text-xs text-gray-400 text-center pb-2">
          Fine-tuned models are private to your OpenAI account and are never used to train
          OpenAI&apos;s base models.
        </p>
      </div>
    </>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BrainCircuit, Download, Play, RefreshCw,
  CheckCircle2, XCircle, Loader2, AlertCircle,
  BookOpen, Cpu,
} from "lucide-react";

interface Stats {
  totalCorrections: number;
  invoicesWithCorrections: number;
  invoicesWithOcr: number;
  correctionsByField: Array<{ field: string; count: number }>;
  finetune: {
    jobId: string | null;
    modelId: string | null;
    status: string | null;
  };
}

interface JobStatus {
  jobId: string;
  status: "running" | "succeeded" | "failed";
  openaiStatus: string;
  fineTunedModelId: string | null;
  trainedTokens: number | null;
  error: string | null;
}

const MIN_EXAMPLES = 10;

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const map: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    running:   { color: "bg-blue-50 text-blue-700 border-blue-200",   icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, label: "Training…" },
    succeeded: { color: "bg-green-50 text-green-700 border-green-200", icon: <CheckCircle2 className="w-3.5 h-3.5" />,          label: "Ready" },
    failed:    { color: "bg-red-50 text-red-700 border-red-200",       icon: <XCircle className="w-3.5 h-3.5" />,               label: "Failed" },
  };
  const cfg = map[status] ?? { color: "bg-gray-100 text-gray-600 border-gray-200", icon: null, label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

export default function TrainingPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingJob, setStartingJob] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/training/stats");
      const data = await res.json();
      setStats(data);
    } catch {
      setError("Failed to load training stats");
    } finally {
      setLoading(false);
    }
  }, []);

  const pollStatus = useCallback(async () => {
    setPolling(true);
    try {
      const res = await fetch("/api/training/status");
      const data = await res.json();
      if (data.jobId) {
        setJobStatus(data);
        // Refresh stats too (model ID may have been saved)
        await fetchStats();
      }
    } catch {
      setError("Failed to check job status");
    } finally {
      setPolling(false);
    }
  }, [fetchStats]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Auto-poll while a job is running
  useEffect(() => {
    if (stats?.finetune.status !== "running") return;
    const interval = setInterval(pollStatus, 30_000);
    return () => clearInterval(interval);
  }, [stats?.finetune.status, pollStatus]);

  const startFineTune = async () => {
    setError(null);
    setStartingJob(true);
    try {
      const res = await fetch("/api/training/finetune", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to start fine-tuning job");
      } else {
        await fetchStats();
        setJobStatus({ jobId: data.jobId, status: "running", openaiStatus: "queued", fineTunedModelId: null, trainedTokens: null, error: null });
      }
    } catch {
      setError("Network error starting fine-tuning job");
    } finally {
      setStartingJob(false);
    }
  };

  const exportData = () => {
    window.open("/api/training/export", "_blank");
  };

  const canFineTune = (stats?.invoicesWithCorrections ?? 0) >= MIN_EXAMPLES;
  const isRunning = stats?.finetune.status === "running";

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="h-16 bg-white border-b border-gray-100 flex items-center px-6 flex-shrink-0 pl-16 lg:pl-6">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Training & Learning</h1>
          <p className="text-xs text-gray-400">
            Teach the model from admin corrections — few-shot learning is active immediately
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* How it works */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
          <h2 className="font-semibold text-indigo-900 text-sm mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            How the system learns
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-indigo-800">
            <div className="space-y-1">
              <div className="font-semibold text-indigo-900">1 · Immediate (active now)</div>
              <p>Every time you edit a field in the invoice detail, the correction is stored. On the next extraction, matching corrections are injected into the AI prompt as few-shot examples — no extra cost, no waiting.</p>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-indigo-900">2 · Export training data</div>
              <p>Download all corrections as a JSONL file (OpenAI fine-tuning format). You can inspect it, use it with Label Studio, or feed it to any model.</p>
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-indigo-900">3 · Fine-tune gpt-4o-mini</div>
              <p>With {MIN_EXAMPLES}+ corrected invoices, launch a private fine-tuning job on OpenAI. The resulting model is exclusive to your API key and is automatically used for all future extractions.</p>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total corrections", value: stats?.totalCorrections ?? 0, color: "text-indigo-600" },
            { label: "Invoices corrected", value: stats?.invoicesWithCorrections ?? 0, color: "text-indigo-600" },
            { label: "With OCR text", value: stats?.invoicesWithOcr ?? 0, color: "text-gray-600" },
            { label: "For fine-tuning", value: `${stats?.invoicesWithCorrections ?? 0} / ${MIN_EXAMPLES}`, color: canFineTune ? "text-green-600" : "text-amber-600" },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Corrections by field */}
        {stats && stats.correctionsByField.length > 0 && (
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">Most corrected fields</h2>
            <div className="space-y-2">
              {stats.correctionsByField.map((f) => {
                const max = stats.correctionsByField[0]?.count ?? 1;
                const pct = Math.round((f.count / max) * 100);
                return (
                  <div key={f.field} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-36 truncate font-mono">{f.field}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-600 w-6 text-right">{f.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {stats && stats.correctionsByField.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-xl p-8 text-center">
            <BrainCircuit className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No corrections yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              Edit invoice fields in the Dashboard to start building training data.
            </p>
          </div>
        )}

        {/* Fine-tuning panel */}
        <div className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-500" />
              Fine-tuning (OpenAI)
            </h2>
            {stats?.finetune.status && <StatusBadge status={stats.finetune.status} />}
          </div>

          {stats?.finetune.modelId && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs">
              <span className="font-semibold text-green-700">Active fine-tuned model: </span>
              <code className="text-green-800 break-all">{stats.finetune.modelId}</code>
              <p className="text-green-600 mt-1">All new extractions automatically use this model.</p>
            </div>
          )}

          {jobStatus && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs space-y-1">
              <div><span className="text-blue-700 font-semibold">Job ID: </span><code className="text-blue-800">{jobStatus.jobId}</code></div>
              <div><span className="text-blue-700 font-semibold">Status: </span>{jobStatus.openaiStatus}</div>
              {jobStatus.trainedTokens != null && (
                <div><span className="text-blue-700 font-semibold">Tokens trained: </span>{jobStatus.trainedTokens.toLocaleString()}</div>
              )}
              {jobStatus.error && <div className="text-red-600">{jobStatus.error}</div>}
            </div>
          )}

          {!canFineTune && (
            <p className="text-xs text-amber-600">
              Need {MIN_EXAMPLES - (stats?.invoicesWithCorrections ?? 0)} more corrected invoice(s) to start fine-tuning.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={exportData}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export JSONL
            </button>

            <button
              onClick={pollStatus}
              disabled={polling || !stats?.finetune.jobId}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {polling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Check status
            </button>

            <button
              onClick={startFineTune}
              disabled={!canFineTune || isRunning || startingJob}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {startingJob ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isRunning ? "Training in progress…" : "Start fine-tuning"}
            </button>
          </div>

          <p className="text-xs text-gray-400">
            Fine-tuning typically takes 15–60 minutes. The model is private to your OpenAI account
            and is never shared or used to train OpenAI's base models.
          </p>
        </div>
      </div>
    </>
  );
}

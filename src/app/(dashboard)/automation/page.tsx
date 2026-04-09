"use client";

// Anzu Dynamics — Automation Page
// Shows the history of RPA (Playwright) ERP submission jobs.
// Each row: invoice reference, ERP type, action, result status, timestamp, ERP ref.

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, XCircle, Loader2, RefreshCw, Zap, FileText,
  Clock, Filter,
} from "lucide-react";
import Link from "next/link";

interface RpaJob {
  id: string;
  invoiceId: string;
  referenceNo: string;
  fileName: string;
  invoiceStatus: string;
  eventType: string;
  success: boolean;
  erpType: string | null;
  erpReference: string | null;
  message: string | null;
  action: string | null;
  timestamp: string;
}

const ERP_LABELS: Record<string, string> = {
  sinco:   "SINCO",
  siigo:   "Siigo",
  sap_b1:  "SAP B1",
  contpaq: "CONTPAQi",
  mock:    "Mock / Demo",
};

function StatusBadge({ success }: { success: boolean }) {
  return success ? (
    <Badge className="gap-1 bg-green-50 text-green-700 border-green-200">
      <CheckCircle2 className="w-3 h-3" />
      Submitted
    </Badge>
  ) : (
    <Badge variant="destructive" className="gap-1">
      <XCircle className="w-3 h-3" />
      Failed
    </Badge>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: "#FFF7ED" }}
      >
        <Zap className="w-7 h-7" style={{ color: "#F97316" }} />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">No automation jobs yet</h3>
      <p className="text-sm text-gray-500 max-w-xs">
        RPA jobs appear here once you submit invoices to an ERP via the credential
        vault. Configure an ERP connection in{" "}
        <Link href="/settings" className="text-orange-600 hover:underline">
          Settings
        </Link>
        .
      </p>
    </div>
  );
}

export default function AutomationPage() {
  const [jobs, setJobs] = useState<RpaJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "success" | "failed">("all");
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = filter !== "all" ? `?status=${filter}` : "";
      const res = await fetch(`/api/jobs${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { jobs: RpaJob[] };
      setJobs(data.jobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const successCount = jobs.filter((j) => j.success).length;
  const failedCount  = jobs.filter((j) => !j.success).length;

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Automation Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Playwright RPA execution history — ERP submission results
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchJobs}
          disabled={loading}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total Jobs",    value: jobs.length,   color: "text-gray-900" },
          { label: "Submitted",     value: successCount,  color: "text-green-600" },
          { label: "Failed",        value: failedCount,   color: "text-red-600"  },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white rounded-2xl border border-gray-200 p-4"
          >
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{loading ? "—" : value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-gray-400" />
        {(["all", "success", "failed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === f
                ? "text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
            style={filter === f ? { background: "linear-gradient(135deg, #F97316, #EA580C)" } : {}}
          >
            {f === "all" ? "All" : f === "success" ? "Submitted" : "Failed"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {error ? (
          <div className="p-8 text-center text-sm text-red-600">{error}</div>
        ) : loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                  {["Invoice", "ERP", "Action", "Status", "ERP Reference", "Time"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((job, i) => (
                  <tr
                    key={job.id}
                    style={{
                      borderBottom: i < jobs.length - 1 ? "1px solid #F8FAFC" : "none",
                    }}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    {/* Invoice */}
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/invoices/${job.invoiceId}`}
                        className="flex items-center gap-2 group"
                      >
                        <FileText className="w-3.5 h-3.5 text-gray-400 group-hover:text-orange-500 transition-colors" />
                        <div>
                          <p className="font-mono text-xs font-medium text-gray-900 group-hover:text-orange-600 transition-colors">
                            {job.referenceNo}
                          </p>
                          <p className="text-xs text-gray-400 truncate max-w-[160px]">
                            {job.fileName}
                          </p>
                        </div>
                      </Link>
                    </td>

                    {/* ERP */}
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-gray-700">
                        {job.erpType ? (ERP_LABELS[job.erpType] ?? job.erpType) : "—"}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500 capitalize">
                        {job.action ?? "submit"}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge success={job.success} />
                    </td>

                    {/* ERP Reference */}
                    <td className="px-4 py-3">
                      {job.erpReference ? (
                        <code className="text-xs bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded">
                          {job.erpReference}
                        </code>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>

                    {/* Time */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {new Date(job.timestamp).toLocaleString("es-CO", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Message for failed jobs */}
      {!loading && jobs.some((j) => !j.success) && (
        <p className="text-xs text-gray-500 mt-3 text-center">
          Failed jobs are retried automatically by the BullMQ worker.{" "}
          Check your ERP credentials in{" "}
          <Link href="/settings" className="text-orange-600 hover:underline">
            Settings
          </Link>
          .
        </p>
      )}
    </main>
  );
}

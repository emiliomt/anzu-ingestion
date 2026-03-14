"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { Sparkles, Check, X, RefreshCw, Loader2, GitMerge, ChevronDown, ChevronLeft } from "lucide-react";
import { useSearchParams } from "next/navigation";

interface MatchRow {
  id: string;
  referenceNo: string;
  vendorName: string | null;
  total: string | null;
  currency: string | null;
  poReference: string | null;
  projectName: string | null;
  submittedAt: string;
  match: {
    id: string;
    matchType: string;
    matchLabel: string;
    confidence: number | null;
    reasoning: string | null;
    matchedBy: string | null;
    isConfirmed: boolean;
    confirmedBy: string | null;
  } | null;
}

const MATCH_TYPE_COLORS: Record<string, string> = {
  purchase_order: "bg-blue-100 text-blue-700",
  project:        "bg-indigo-100 text-indigo-700",
  caja_chica:     "bg-purple-100 text-purple-700",
};

const MATCH_TYPE_LABELS: Record<string, string> = {
  purchase_order: "PO",
  project:        "Project",
  caja_chica:     "Caja Chica",
};

function ConfidenceBadge({ value }: { value: number | null }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const color = value >= 0.85 ? "text-green-600" : value >= 0.65 ? "text-amber-600" : "text-red-500";
  return <span className={`text-xs font-medium ${color}`}>{pct}%</span>;
}

function MatchingPageInner() {
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<"unmatched" | "pending" | "confirmed" | "all">(
    (searchParams.get("filter") as "pending") ?? "unmatched"
  );
  const [rows, setRows] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchRunning, setBatchRunning] = useState(false);
  const [suggestingId, setSuggestingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const data = await fetch(`/api/matching/list?filter=${filter}`, {
        signal: abortRef.current.signal,
      }).then((r) => r.json() as Promise<MatchRow[]>);
      setRows(data);
    } catch { /* aborted */ }
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function runBatch() {
    setBatchRunning(true);
    await fetch("/api/matching/batch", { method: "POST" });
    setBatchRunning(false);
    await load();
  }

  async function suggestOne(invoiceId: string) {
    setSuggestingId(invoiceId);
    await fetch("/api/matching/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId }),
    });
    setSuggestingId(null);
    await load();
  }

  async function confirm(matchId: string) {
    setConfirmingId(matchId);
    await fetch("/api/matching/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId }),
    });
    setConfirmingId(null);
    await load();
  }

  async function reject(matchId: string) {
    setConfirmingId(matchId);
    await fetch("/api/matching/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, reject: true }),
    });
    setConfirmingId(null);
    await load();
  }

  const filters = [
    { key: "unmatched",  label: "Unmatched" },
    { key: "pending",    label: "Awaiting Review" },
    { key: "confirmed",  label: "Confirmed" },
    { key: "all",        label: "All" },
  ] as const;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex-1">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Menu
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Match Invoices</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            AI-powered matching of processed invoices to Projects, POs, or Caja Chica.
          </p>
        </div>
        <button
          onClick={runBatch}
          disabled={batchRunning}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors"
        >
          {batchRunning
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Running AI…</>
            : <><Sparkles className="w-4 h-4" /> Run AI Batch</>}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit mb-6">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              filter === key
                ? "bg-white shadow-sm font-medium text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <GitMerge className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">
            {filter === "unmatched" ? "All invoices are matched!" : "No invoices in this category."}
          </p>
          {filter === "unmatched" && (
            <p className="text-sm mt-1">New invoices will appear here after extraction.</p>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Invoice</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vendor</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">PO Ref</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Suggestion</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Confidence</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <>
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-gray-500">{row.referenceNo}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.vendorName ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.total ? `${row.currency ?? ""} ${row.total}` : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.poReference ?? "—"}</td>
                    <td className="px-4 py-3">
                      {row.match ? (
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${MATCH_TYPE_COLORS[row.match.matchType] ?? ""}`}>
                            {MATCH_TYPE_LABELS[row.match.matchType] ?? row.match.matchType}
                          </span>
                          <span className="text-gray-700 truncate max-w-[140px]">{row.match.matchLabel}</span>
                          {row.match.isConfirmed && (
                            <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">No suggestion yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ConfidenceBadge value={row.match?.confidence ?? null} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {/* Reasoning expand */}
                        {row.match?.reasoning && (
                          <button
                            onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"
                            title="View reasoning"
                          >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedId === row.id ? "rotate-180" : ""}`} />
                          </button>
                        )}

                        {/* AI suggest (if no match yet or rejected) */}
                        {!row.match && (
                          <button
                            onClick={() => suggestOne(row.id)}
                            disabled={suggestingId === row.id}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg disabled:opacity-50"
                          >
                            {suggestingId === row.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Sparkles className="w-3 h-3" />}
                            Suggest
                          </button>
                        )}

                        {/* Confirm / Reject (if pending suggestion) */}
                        {row.match && !row.match.isConfirmed && (
                          <>
                            <button
                              onClick={() => confirm(row.match!.id)}
                              disabled={confirmingId === row.match.id}
                              className="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg disabled:opacity-50"
                              title="Confirm match"
                            >
                              {confirmingId === row.match.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => reject(row.match!.id)}
                              disabled={confirmingId === row.match.id}
                              className="p-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg disabled:opacity-50"
                              title="Reject suggestion"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Expanded reasoning row */}
                  {expandedId === row.id && row.match?.reasoning && (
                    <tr key={`${row.id}-reasoning`} className="bg-indigo-50">
                      <td colSpan={7} className="px-4 py-2.5">
                        <p className="text-xs text-indigo-700">
                          <span className="font-medium">AI Reasoning: </span>
                          {row.match.reasoning}
                        </p>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function MatchingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center gap-2 text-gray-400 py-12 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    }>
      <MatchingPageInner />
    </Suspense>
  );
}

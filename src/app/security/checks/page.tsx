"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, ShieldX, AlertTriangle, CheckCircle2, Filter } from "lucide-react";

interface Check {
  id: string; referenceNo: string; channel: string;
  processedAt: string | null; vendorName: string | null;
  passed: boolean; flags: string[]; fields: Record<string, string | null>;
}
interface Data { recentChecks: Check[]; failedInvoices: Check[] }

function RiskBadge({ flags }: { flags: string[] }) {
  const failed = flags.includes("security_failed");
  if (flags.includes("vendor_blacklisted"))
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700"><ShieldX className="w-3 h-3" />SAT Blacklist</span>;
  if (failed)
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700"><AlertTriangle className="w-3 h-3" />Failed</span>;
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" />Passed</span>;
}

export default function SecurityChecksPage() {
  const [data, setData] = useState<Data | null>(null);
  const [filter, setFilter] = useState<"all" | "failed" | "passed">("all");

  useEffect(() => {
    fetch("/api/security/invoices")
      .then((r) => r.json() as Promise<Data>)
      .then(setData)
      .catch(() => {});
  }, []);

  const all: Check[] = [
    ...(data?.failedInvoices ?? []),
    ...(data?.recentChecks ?? []).filter((c) => c.passed),
  ].sort((a, b) => new Date(b.processedAt ?? 0).getTime() - new Date(a.processedAt ?? 0).getTime());

  const rows =
    filter === "failed" ? all.filter((c) => !c.passed) :
    filter === "passed" ? all.filter((c) =>  c.passed) :
    all;

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 font-bold text-xl">Security Checks</h1>
          <p className="text-gray-500 text-xs mt-0.5">Full audit log of invoice security verification</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {(["all", "failed", "passed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={filter === f
                ? { background: "#DC2626", color: "#fff" }
                : { background: "#F1F5F9", color: "#64748B" }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No checks to display</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                  {["Reference", "Vendor", "Vendor RFC", "Buyer RFC", "Channel", "Processed", "Result"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((chk) => (
                  <tr key={chk.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/admin/invoices/${chk.id}`} className="text-xs font-semibold hover:underline" style={{ color: "#DC2626" }}>
                        {chk.referenceNo}
                      </Link>
                    </td>
                    <td className="px-5 py-3"><span className="text-xs text-gray-700">{chk.vendorName ?? "—"}</span></td>
                    <td className="px-5 py-3"><span className="text-xs font-mono text-gray-600">{chk.fields?.vendor_tax_id ?? "—"}</span></td>
                    <td className="px-5 py-3"><span className="text-xs font-mono text-gray-600">{chk.fields?.buyer_tax_id ?? "—"}</span></td>
                    <td className="px-5 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 capitalize">{chk.channel}</span>
                    </td>
                    <td className="px-5 py-3"><span className="text-xs text-gray-500">{chk.processedAt ? new Date(chk.processedAt).toLocaleString() : "—"}</span></td>
                    <td className="px-5 py-3"><RiskBadge flags={chk.flags} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck, ShieldAlert, ShieldX, CheckCircle2,
  AlertTriangle, Clock, ArrowRight, Settings, Sparkles,
} from "lucide-react";

interface Stats { failed: number; passed: number; total: number; passRate: number }
interface FailedInvoice {
  id: string; referenceNo: string; channel: string; status: string;
  submittedAt: string; vendorName: string | null;
  flags: string[]; fields: Record<string, string | null>;
}
interface RecentCheck {
  id: string; referenceNo: string; channel: string;
  processedAt: string | null; vendorName: string | null;
  passed: boolean; flags: string[]; fields: Record<string, string | null>;
}
interface SecurityData {
  stats: Stats;
  failedInvoices: FailedInvoice[];
  recentChecks: RecentCheck[];
}

function RiskBadge({ flags }: { flags: string[] }) {
  const failed = flags.includes("security_failed");
  const blacklisted = flags.includes("vendor_blacklisted");
  if (blacklisted)
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700"><ShieldX className="w-3 h-3" />SAT Blacklist</span>;
  if (failed)
    return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700"><AlertTriangle className="w-3 h-3" />Failed</span>;
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" />Passed</span>;
}

function ChannelBadge({ channel }: { channel: string }) {
  const cfg: Record<string, { label: string; bg: string; color: string }> = {
    web:      { label: "Web",      bg: "#EEF2FF", color: "#4F46E5" },
    email:    { label: "Email",    bg: "#F0FDF4", color: "#16A34A" },
    whatsapp: { label: "WhatsApp", bg: "#F0FDF4", color: "#15803D" },
  };
  const c = cfg[channel] ?? { label: channel, bg: "#F1F5F9", color: "#64748B" };
  return (
    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

export default function SecurityDashboardPage() {
  const [data, setData] = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/security/invoices")
      .then((r) => r.json() as Promise<SecurityData>)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const S = {
    passRate:  data?.stats.passRate  ?? 100,
    passed:    data?.stats.passed    ?? 0,
    failed:    data?.stats.failed    ?? 0,
    total:     data?.stats.total     ?? 0,
  };

  const statCards = [
    {
      label: "Pass Rate",
      value: `${S.passRate}%`,
      sub: `${S.total} invoices checked`,
      icon: ShieldCheck, iconBg: "#ECFDF5", iconColor: "#059669",
    },
    {
      label: "Passed",
      value: String(S.passed),
      sub: "buyer & vendor verified",
      icon: CheckCircle2, iconBg: "#EEF2FF", iconColor: "#4F46E5",
    },
    {
      label: "Failed",
      value: String(S.failed),
      sub: "require review",
      icon: ShieldAlert, iconBg: "#FEF2F2", iconColor: "#DC2626",
    },
    {
      label: "Configure Rules",
      value: "Settings",
      sub: "buyer name, tax ID, address",
      icon: Settings, iconBg: "#FFF7ED", iconColor: "#EA580C",
      href: "/security/settings",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 font-bold text-xl">Security Dashboard</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            Buyer verification &amp; SAT Art.69-B EFOS blacklist checks
          </p>
        </div>
        <Link
          href="/security/settings"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #DC2626, #B91C1C)" }}
        >
          <Sparkles className="w-4 h-4" />
          Configure Rules
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, sub, icon: Icon, iconBg, iconColor, href }) => {
          const inner = (
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm text-gray-500">{label}</p>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: iconBg }}>
                  <Icon style={{ color: iconColor, width: 18, height: 18 }} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? <span className="inline-block w-12 h-6 bg-gray-100 rounded animate-pulse" /> : value}
              </p>
              <p className="text-xs text-gray-400 mt-1">{sub}</p>
            </div>
          );
          return href ? <Link key={label} href={href}>{inner}</Link> : <div key={label}>{inner}</div>;
        })}
      </div>

      {/* Alert banners */}
      {!loading && S.failed > 0 && (
        <div
          className="flex items-center justify-between px-5 py-3.5 rounded-xl"
          style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)" }}
        >
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-4 h-4 shrink-0" style={{ color: "#DC2626" }} />
            <span className="text-sm font-medium" style={{ color: "#7F1D1D" }}>
              <strong>{S.failed} invoice{S.failed !== 1 ? "s" : ""} failed security checks</strong> — manual review required
            </span>
          </div>
          <Link
            href="/security/checks"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-all hover:opacity-90 shrink-0"
            style={{ background: "#DC2626" }}
          >
            Review <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {!loading && S.failed === 0 && S.total > 0 && (
        <div
          className="flex items-center gap-3 px-5 py-3 rounded-xl"
          style={{ background: "#ECFDF5", border: "1px solid #A7F3D0" }}
        >
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
          <span className="text-sm text-emerald-800">
            <strong>All {S.total} invoices passed</strong> security verification
          </span>
        </div>
      )}

      {/* Failed invoices table */}
      {!loading && (data?.failedInvoices?.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="text-gray-900 font-semibold text-sm flex items-center gap-2">
              <ShieldX className="w-4 h-4 text-red-500" />
              Failed Security Checks
            </h3>
            <Link href="/security/checks" className="text-xs font-medium flex items-center gap-1 transition-colors" style={{ color: "#DC2626" }}>
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                  {["Reference", "Vendor", "Channel", "Tax ID", "Submitted", "Reason"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data!.failedInvoices.slice(0, 8).map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/admin/invoices/${inv.id}`} className="text-xs font-semibold hover:underline" style={{ color: "#DC2626" }}>
                        {inv.referenceNo}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-gray-700 truncate max-w-[140px] block">{inv.vendorName ?? "—"}</span>
                    </td>
                    <td className="px-5 py-3"><ChannelBadge channel={inv.channel} /></td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-mono text-gray-600">{inv.fields.vendor_tax_id ?? "—"}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-gray-500">
                        {new Date(inv.submittedAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-5 py-3"><RiskBadge flags={inv.flags} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent checks table */}
      {!loading && (data?.recentChecks?.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="text-gray-900 font-semibold text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              Recent Checks
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                  {["Reference", "Vendor", "Channel", "Processed", "Result"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data!.recentChecks.map((chk) => (
                  <tr key={chk.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/admin/invoices/${chk.id}`} className="text-xs font-semibold hover:underline" style={{ color: "#DC2626" }}>
                        {chk.referenceNo}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-gray-700 truncate max-w-[140px] block">{chk.vendorName ?? "—"}</span>
                    </td>
                    <td className="px-5 py-3"><ChannelBadge channel={chk.channel} /></td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-gray-500">
                        {chk.processedAt ? new Date(chk.processedAt).toLocaleDateString() : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3"><RiskBadge flags={chk.flags} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && S.total === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <ShieldCheck className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <h3 className="text-gray-700 font-semibold mb-2">No invoices checked yet</h3>
          <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
            Configure buyer verification rules then upload or receive invoices to see security results.
          </p>
          <Link
            href="/security/settings"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "#DC2626" }}
          >
            <Settings className="w-4 h-4" />
            Configure Rules
          </Link>
        </div>
      )}
    </div>
  );
}

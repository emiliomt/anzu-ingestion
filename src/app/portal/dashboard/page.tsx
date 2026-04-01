"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser, UserButton } from "@clerk/nextjs";
import {
  Upload, Search, Clock, CheckCircle2, AlertTriangle,
  FileText, ArrowRight, Calendar, DollarSign, Hourglass,
  ShieldAlert, RefreshCw,
} from "lucide-react";
import { AnzuLogo } from "@/components/landing/AnzuLogo";

interface Invoice {
  id: string; referenceNo: string; channel: string; status: string;
  fileName: string; submittedAt: string; processedAt: string | null;
  paidAt: string | null; flags: string[];
  vendorName: string | null; invoiceNumber: string | null;
  total: string | null; currency: string | null;
  daysSinceSubmission: number; daysToPaid: number | null;
}

interface Data { email: string; invoices: Invoice[] }

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; bg: string; color: string; icon: React.ElementType }> = {
  received:   { label: "Received",   bg: "#EEF2FF", color: "#4F46E5", icon: FileText    },
  processing: { label: "Processing", bg: "#FFF7ED", color: "#EA580C", icon: RefreshCw   },
  extracted:  { label: "Extracted",  bg: "#F0FDF4", color: "#16A34A", icon: CheckCircle2},
  reviewed:   { label: "Reviewed",   bg: "#F0FDF4", color: "#059669", icon: CheckCircle2},
  complete:   { label: "Paid",       bg: "#ECFDF5", color: "#059669", icon: DollarSign  },
  error:      { label: "Error",      bg: "#FEF2F2", color: "#DC2626", icon: AlertTriangle},
};

function StatusBadge({ status, paidAt }: { status: string; paidAt: string | null }) {
  const key = paidAt ? "complete" : status;
  const cfg = STATUS_CFG[key] ?? { label: key, bg: "#F1F5F9", color: "#64748B", icon: FileText };
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

function DaysBadge({ days, isPaid }: { days: number; isPaid: boolean }) {
  const color = isPaid ? "#059669" : days > 30 ? "#DC2626" : days > 14 ? "#D97706" : "#64748B";
  const bg    = isPaid ? "#ECFDF5" : days > 30 ? "#FEF2F2" : days > 14 ? "#FFFBEB" : "#F8FAFC";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: bg, color }}>
      <Hourglass className="w-3 h-3" />
      {days}d
    </span>
  );
}

// ── Summary card ───────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, icon: Icon, iconBg, iconColor }:
  { label: string; value: string | number; sub: string; icon: React.ElementType; iconBg: string; iconColor: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-gray-500">{label}</p>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: iconBg }}>
          <Icon style={{ color: iconColor, width: 18, height: 18 }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ProviderDashboard() {
  const { isLoaded, user } = useUser();
  const [data, setData]   = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    fetch("/api/portal/invoices")
      .then((r) => r.json() as Promise<Data>)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isLoaded]);

  const invoices = data?.invoices ?? [];

  const stats = {
    total:   invoices.length,
    pending: invoices.filter((i) => !i.paidAt && i.status !== "error").length,
    paid:    invoices.filter((i) => !!i.paidAt).length,
    avgDays: (() => {
      const paid = invoices.filter((i) => i.daysToPaid != null);
      if (!paid.length) return null;
      return Math.round(paid.reduce((s, i) => s + (i.daysToPaid ?? 0), 0) / paid.length);
    })(),
  };

  return (
    <div className="min-h-screen" style={{ background: "#F8FAFC" }}>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100"
        style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/portal"><AnzuLogo variant="full" scheme="light" size={26} /></Link>
          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-gray-600">
            <Link href="/portal" className="hover:text-orange-500 transition-colors">Submit Invoice</Link>
            <Link href="/status/lookup" className="hover:text-orange-500 transition-colors">Track</Link>
            <span className="font-semibold text-gray-900">My Invoices</span>
          </nav>
          <UserButton afterSignOutUrl="/portal" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Welcome */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-gray-900 font-bold text-xl">
              {isLoaded && user ? `Welcome, ${user.firstName ?? user.emailAddresses[0]?.emailAddress}` : "My Invoices"}
            </h1>
            <p className="text-gray-500 text-xs mt-0.5">Track your submitted invoices and payment status</p>
          </div>
          <Link
            href="/portal"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
          >
            <Upload className="w-4 h-4" />
            New Invoice
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Submitted" value={loading ? "—" : stats.total}
            sub="all time" icon={FileText} iconBg="#EEF2FF" iconColor="#4F46E5" />
          <SummaryCard label="Pending Payment" value={loading ? "—" : stats.pending}
            sub="awaiting confirmation" icon={Clock} iconBg="#FFF7ED" iconColor="#EA580C" />
          <SummaryCard label="Paid" value={loading ? "—" : stats.paid}
            sub="payment confirmed" icon={DollarSign} iconBg="#ECFDF5" iconColor="#059669" />
          <SummaryCard
            label="Avg. Days to Payment"
            value={loading ? "—" : stats.avgDays != null ? `${stats.avgDays}d` : "—"}
            sub="from submission to paid"
            icon={Hourglass} iconBg="#F0FDF4" iconColor="#10B981"
          />
        </div>

        {/* Invoice table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="text-gray-900 font-semibold text-sm">Invoice History</h3>
            <Link href="/status/lookup"
              className="text-xs font-medium flex items-center gap-1 transition-colors" style={{ color: "#F97316" }}>
              <Search className="w-3 h-3" /> Track by reference
            </Link>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-6 h-6 text-gray-300 mx-auto mb-3 animate-spin" />
              <p className="text-gray-400 text-sm">Loading your invoices…</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <h4 className="text-gray-700 font-semibold mb-2">No invoices yet</h4>
              <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
                Submit your first invoice and it will appear here with real-time status tracking.
              </p>
              <Link href="/portal"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}>
                <Upload className="w-4 h-4" /> Submit Invoice
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                    {["Reference", "Vendor", "Amount", "Submitted", "Days", "Status"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <div>
                          <Link href={`/status/lookup?ref=${inv.referenceNo}`}
                            className="text-xs font-semibold hover:underline" style={{ color: "#F97316" }}>
                            {inv.referenceNo}
                          </Link>
                          {inv.invoiceNumber && (
                            <p className="text-xs text-gray-400 mt-0.5">#{inv.invoiceNumber}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-gray-700 truncate max-w-[140px] block">
                          {inv.vendorName ?? inv.fileName}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {inv.total ? (
                          <span className="text-xs font-bold text-gray-900">
                            {inv.currency ?? ""} {Number(inv.total).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div>
                          <span className="text-xs text-gray-600">
                            {new Date(inv.submittedAt).toLocaleDateString()}
                          </span>
                          {inv.paidAt && (
                            <p className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              Paid {new Date(inv.paidAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <DaysBadge
                          days={inv.daysToPaid ?? inv.daysSinceSubmission}
                          isPaid={!!inv.paidAt}
                        />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={inv.status} paidAt={inv.paidAt} />
                          {inv.flags.includes("security_failed") && (
                            <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" aria-label="Security check failed" />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info banner: account-linked vs email-submitted */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
          <Calendar className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700">
            This dashboard shows invoices submitted with the email <strong>{data?.email}</strong>.
            Invoices submitted before you created your account (same email) are included automatically.
          </p>
        </div>
      </main>
    </div>
  );
}

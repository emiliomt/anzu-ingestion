"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderOpen, ShoppingCart, Coins, GitMerge, ChevronRight, Loader2 } from "lucide-react";

interface Stats {
  projects: { total: number; active: number };
  pos: { total: number; open: number };
  cajaChica: { total: number; open: number };
  matching: { unmatched: number; pending: number; confirmed: number };
}

export default function MatcherDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    async function load() {
      const [projects, pos, cajaChica, unmatched, pending, confirmed] = await Promise.all([
        fetch("/api/projects").then((r) => r.json() as Promise<{ status: string }[]>),
        fetch("/api/purchase-orders").then((r) => r.json() as Promise<{ status: string }[]>),
        fetch("/api/caja-chica").then((r) => r.json() as Promise<{ status: string }[]>),
        fetch("/api/matching/list?filter=unmatched").then((r) => r.json() as Promise<unknown[]>),
        fetch("/api/matching/list?filter=pending").then((r) => r.json() as Promise<unknown[]>),
        fetch("/api/matching/list?filter=confirmed").then((r) => r.json() as Promise<unknown[]>),
      ]);
      setStats({
        projects: { total: projects.length, active: projects.filter((p) => p.status === "active").length },
        pos: { total: pos.length, open: pos.filter((p) => p.status === "open" || p.status === "partially_matched").length },
        cajaChica: { total: cajaChica.length, open: cajaChica.filter((c) => c.status === "open").length },
        matching: {
          unmatched: unmatched.length,
          pending: pending.length,
          confirmed: confirmed.length,
        },
      });
    }
    load();
  }, []);

  const cards = [
    {
      label: "Projects",
      href: "/matcher/projects",
      icon: FolderOpen,
      color: "bg-blue-50 border-blue-200",
      iconColor: "text-blue-600",
      primary: stats?.projects.active ?? "-",
      primaryLabel: "active",
      secondary: stats?.projects.total ?? "-",
      secondaryLabel: "total",
    },
    {
      label: "Purchase Orders",
      href: "/matcher/purchase-orders",
      icon: ShoppingCart,
      color: "bg-amber-50 border-amber-200",
      iconColor: "text-amber-600",
      primary: stats?.pos.open ?? "-",
      primaryLabel: "open",
      secondary: stats?.pos.total ?? "-",
      secondaryLabel: "total",
    },
    {
      label: "Caja Chica",
      href: "/matcher/caja-chica",
      icon: Coins,
      color: "bg-purple-50 border-purple-200",
      iconColor: "text-purple-600",
      primary: stats?.cajaChica.open ?? "-",
      primaryLabel: "open",
      secondary: stats?.cajaChica.total ?? "-",
      secondaryLabel: "total",
    },
    {
      label: "Match Invoices",
      href: "/matcher/matching",
      icon: GitMerge,
      color: "bg-emerald-50 border-emerald-200",
      iconColor: "text-emerald-600",
      primary: stats?.matching.unmatched ?? "-",
      primaryLabel: "unmatched",
      secondary: stats?.matching.pending ?? "-",
      secondaryLabel: "awaiting review",
    },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Matcher Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Match processed invoices to Projects, Purchase Orders, or Caja Chica.
        </p>
      </div>

      {!stats ? (
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {cards.map(({ label, href, icon: Icon, color, iconColor, primary, primaryLabel, secondary, secondaryLabel }) => (
              <Link
                key={href}
                href={href}
                className={`border rounded-xl p-5 ${color} hover:shadow-md transition-shadow group`}
              >
                <div className="flex items-center justify-between mb-3">
                  <Icon className={`w-5 h-5 ${iconColor}`} />
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {primary} <span className="text-sm font-normal text-gray-500">{primaryLabel}</span>
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {secondary} {secondaryLabel}
                </div>
                <div className="text-sm font-medium text-gray-700 mt-2">{label}</div>
              </Link>
            ))}
          </div>

          {/* Quick action */}
          {stats.matching.unmatched > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="font-medium text-emerald-900">
                  {stats.matching.unmatched} invoice{stats.matching.unmatched !== 1 ? "s" : ""} need matching
                </p>
                <p className="text-sm text-emerald-700 mt-0.5">
                  Run AI batch matching to get suggestions for all unmatched invoices.
                </p>
              </div>
              <Link
                href="/matcher/matching"
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Go to Matching
              </Link>
            </div>
          )}

          {stats.matching.pending > 0 && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="font-medium text-amber-900">
                  {stats.matching.pending} suggestion{stats.matching.pending !== 1 ? "s" : ""} awaiting review
                </p>
                <p className="text-sm text-amber-700 mt-0.5">
                  AI has suggested matches — review and confirm or reject them.
                </p>
              </div>
              <Link
                href="/matcher/matching?filter=pending"
                className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors"
              >
                Review Now
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

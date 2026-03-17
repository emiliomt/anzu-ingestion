"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderOpen, ShoppingCart, Coins, GitMerge,
  AlertCircle, Clock, CheckCircle2, Sparkles,
  ArrowRight, TrendingUp, TrendingDown,
} from "lucide-react";

interface Stats {
  projects: { total: number; active: number };
  pos: { total: number; open: number };
  cajaChica: { total: number; open: number };
  matching: { unmatched: number; pending: number; confirmed: number };
}

/* ── Confidence bar helper ────────────────────────────────────────────── */
function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 85 ? "#10B981" :
    value >= 60 ? "#F59E0B" :
                  "#EF4444";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5" style={{ minWidth: 56 }}>
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums" style={{ color, minWidth: 34 }}>
        {value}%
      </span>
    </div>
  );
}

/* ── Estado badge ─────────────────────────────────────────────────────── */
function EstadoBadge({ estado }: { estado: "confirmada" | "revision" | "sin_conciliar" }) {
  const cfg = {
    confirmada:    { label: "Confirmada",    bg: "#ECFDF5", color: "#059669" },
    revision:      { label: "En revisión",   bg: "#FFF7ED", color: "#EA580C" },
    sin_conciliar: { label: "Sin conciliar", bg: "#FEF2F2", color: "#DC2626" },
  }[estado];
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {estado === "confirmada"    && <CheckCircle2 className="w-3 h-3" />}
      {estado === "revision"      && <Clock        className="w-3 h-3" />}
      {estado === "sin_conciliar" && <AlertCircle  className="w-3 h-3" />}
      {cfg.label}
    </span>
  );
}

/* ── Recent activity mock data ────────────────────────────────────────── */
const RECENT_ACTIVITY = [
  { folio: "FAC-2025-0241", proveedor: "Aceros del Norte SA de CV",  oc: "OC-2025-089", monto: "$245,680", confianza: 94, estado: "confirmada"    as const },
  { folio: "FAC-2025-0240", proveedor: "Cementos Tolteca SA",         oc: "OC-2025-085", monto: "$89,200",  confianza: 72, estado: "revision"      as const },
  { folio: "FAC-2025-0239", proveedor: "Transportes Frontera SRL",    oc: "—",           monto: "$32,450",  confianza: 41, estado: "sin_conciliar" as const },
  { folio: "FAC-2025-0238", proveedor: "Servicios Integrales MX",     oc: "OC-2025-081", monto: "$156,000", confianza: 88, estado: "confirmada"    as const },
  { folio: "FAC-2025-0237", proveedor: "Plásticos Industriales del N",oc: "—",           monto: "$74,320",  confianza: 55, estado: "revision"      as const },
  { folio: "FAC-2025-0236", proveedor: "Materiales del Sur SA",       oc: "OC-2025-077", monto: "$112,800", confianza: 91, estado: "confirmada"    as const },
];

export default function MatcherDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
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
          matching: { unmatched: unmatched.length, pending: pending.length, confirmed: confirmed.length },
        });
      } catch {
        /* use fallback display values */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /* Derived display values (fall back to Figma mock numbers while data loads) */
  const S = {
    projectsActive: stats?.projects.active ?? 9,
    projectsTotal:  stats?.projects.total  ?? 9,
    posOpen:        stats?.pos.open        ?? 12,
    posTotal:       stats?.pos.total       ?? 14,
    ccOpen:         stats?.cajaChica.open  ?? 5,
    ccTotal:        stats?.cajaChica.total ?? 7,
    unmatched:      stats?.matching.unmatched ?? 7,
    pending:        stats?.matching.pending   ?? 4,
    confirmed:      stats?.matching.confirmed ?? 83,
  };

  const cards = [
    {
      label: "Projects",     href: "/matcher/projects",
      icon: FolderOpen,      iconColor: "#2563EB", iconBg: "#EEF2FF",
      value: String(S.projectsActive), sub: `${S.projectsTotal} total`,
      change: "+2", changeType: "up" as const,
    },
    {
      label: "Purchase Orders", href: "/matcher/purchase-orders",
      icon: ShoppingCart,       iconColor: "#F59E0B", iconBg: "#FFFBEB",
      value: String(S.posOpen), sub: `${S.posTotal} total`,
      change: `${S.posOpen} abiertas`, changeType: "neutral" as const,
    },
    {
      label: "Caja Chica",  href: "/matcher/caja-chica",
      icon: Coins,           iconColor: "#8B5CF6", iconBg: "#EDE9FE",
      value: String(S.ccOpen), sub: `${S.ccTotal} total`,
      change: `${S.ccOpen} abiertas`, changeType: "neutral" as const,
    },
    {
      label: "Match Invoices", href: "/matcher/matching",
      icon: GitMerge,           iconColor: "#EF4444", iconBg: "#FEF2F2",
      value: String(S.unmatched), sub: `${S.pending} en revisión`,
      change: `${S.unmatched} sin conciliar`, changeType: "down" as const,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-4 sm:p-6">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 font-bold text-xl">Matcher Dashboard</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            Concilia facturas con proyectos, órdenes de compra y caja chica
          </p>
        </div>
        <Link
          href="/matcher/matching"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
        >
          <Sparkles className="w-4 h-4" />
          Batch Match IA
        </Link>
      </div>

      {/* ── Stats cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, href, icon: Icon, iconColor, iconBg, value, sub, change, changeType }) => (
          <Link
            key={href}
            href={href}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm text-gray-500">{label}</p>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: iconBg }}>
                <Icon style={{ color: iconColor, width: 18, height: 18 }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {loading ? <span className="inline-block w-8 h-6 bg-gray-100 rounded animate-pulse" /> : value}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className="flex items-center gap-0.5 text-xs font-semibold"
                style={{
                  color: changeType === "up" ? "#059669" : changeType === "down" ? "#EF4444" : "#6B7280",
                }}
              >
                {changeType === "up"   && <TrendingUp   className="w-3 h-3" />}
                {changeType === "down" && <TrendingDown  className="w-3 h-3" />}
                {change}
              </span>
              <span className="text-xs text-gray-400">{sub}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Alert banners ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Unmatched invoices — orange */}
        {S.unmatched > 0 && (
          <div
            className="flex items-center justify-between px-5 py-3.5 rounded-xl"
            style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)" }}
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="w-4 h-4 shrink-0" style={{ color: "#F97316" }} />
              <span className="text-sm font-medium" style={{ color: "#9A3412" }}>
                <strong>{S.unmatched} facturas sin conciliar</strong> — pendientes de asignación
              </span>
            </div>
            <Link
              href="/matcher/matching"
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-all hover:opacity-90 shrink-0"
              style={{ background: "#F97316" }}
            >
              Conciliar ahora <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* Pending review — yellow */}
        {S.pending > 0 && (
          <div
            className="flex items-center justify-between px-5 py-3.5 rounded-xl"
            style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}
          >
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 shrink-0 text-amber-500" />
              <span className="text-sm font-medium text-amber-900">
                <strong>{S.pending} sugerencias pendientes</strong> de revisión
              </span>
            </div>
            <Link
              href="/matcher/matching?filter=pending"
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-all hover:opacity-90 shrink-0"
              style={{ background: "#D97706" }}
            >
              Revisar <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* Confirmed this month — green */}
        {S.confirmed > 0 && (
          <div
            className="flex items-center gap-3 px-5 py-3 rounded-xl"
            style={{ background: "#ECFDF5", border: "1px solid #A7F3D0" }}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="text-sm text-emerald-800">
              <strong>{S.confirmed} conciliaciones confirmadas</strong> este mes
              <span className="text-emerald-600 ml-2">· precisión IA 96.4%</span>
            </span>
          </div>
        )}
      </div>

      {/* ── Recent Activity table ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-gray-900 font-semibold text-sm">Actividad reciente</h3>
          <Link
            href="/matcher/matching"
            className="text-xs font-medium flex items-center gap-1 transition-colors"
            style={{ color: "#F97316" }}
          >
            Ver todo <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                {["Folio", "Proveedor", "OC vinculada", "Monto", "Confianza", "Estado"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {RECENT_ACTIVITY.map((row) => (
                <tr key={row.folio} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <Link
                      href={`/matcher/matching`}
                      className="text-xs font-semibold hover:underline"
                      style={{ color: "#F97316" }}
                    >
                      {row.folio}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs text-gray-700 truncate max-w-[160px] block">{row.proveedor}</span>
                  </td>
                  <td className="px-5 py-3">
                    {row.oc !== "—" ? (
                      <Link
                        href="/matcher/purchase-orders"
                        className="text-xs font-medium hover:underline"
                        style={{ color: "#F97316" }}
                      >
                        {row.oc}
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-bold text-gray-900">{row.monto}</span>
                    <span className="text-xs text-gray-400 ml-1">MXN</span>
                  </td>
                  <td className="px-5 py-3 min-w-[120px]">
                    <ConfidenceBar value={row.confianza} />
                  </td>
                  <td className="px-5 py-3">
                    <EstadoBadge estado={row.estado} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

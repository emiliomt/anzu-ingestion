"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { RefreshCw } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CategoryRow {
  category: string;
  accountCode: string;
  accountLabel: string;
  total: number;
  invoiceCount: number;
}

interface ProjectRow {
  projectId: string;
  projectName: string;
  total: number;
  invoiceCount: number;
  byCategory: Record<string, number>;
}

interface MonthRow {
  month: string;
  total: number;
  byCategory: Record<string, number>;
}

interface Summary {
  totals: { regular: number; cajaChica: number; grand: number };
  byCategory: CategoryRow[];
  byProject: ProjectRow[];
  byMonth: MonthRow[];
  invoiceCount: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PERIODS = [
  { value: "month",   label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "ytd",     label: "Year to Date" },
  { value: "all",     label: "All Time" },
];

const CATEGORY_COLORS: Record<string, string> = {
  material:  "#f97316",
  labor:     "#3b82f6",
  equipment: "#8b5cf6",
  freight:   "#06b6d4",
  overhead:  "#10b981",
  tax:       "#ef4444",
  discount:  "#6b7280",
  other:     "#d1d5db",
};

const CATEGORY_LABELS: Record<string, string> = {
  material:  "Materials",
  labor:     "Labor",
  equipment: "Equipment",
  freight:   "Freight",
  overhead:  "Overhead",
  tax:       "Taxes",
  discount:  "Discounts",
  other:     "Other",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtFull(v: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0,
  }).format(v);
}

function periodLabel(period: string) {
  const now = new Date();
  if (period === "month") return now.toLocaleString("default", { month: "long", year: "numeric" });
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `Q${q} ${now.getFullYear()}`;
  }
  if (period === "ytd") return `Jan – ${now.toLocaleString("default", { month: "short" })} ${now.getFullYear()}`;
  return "All Time";
}

// Custom tooltip for currency amounts
function CurrencyTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-medium text-gray-800">{fmtFull(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChartsPage() {
  const [period, setPeriod] = useState("ytd");
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/preaccounting/summary?period=${period}`);
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  // ── Derived chart data ────────────────────────────────────────────────────

  // Monthly area chart — stack by top 4 categories
  const topCats = (data?.byCategory ?? [])
    .slice(0, 5)
    .map((c) => c.category);

  const monthlyData = (data?.byMonth ?? []).map((m) => {
    const row: Record<string, string | number> = {
      month: new Date(m.month + "-01").toLocaleString("default", { month: "short", year: "2-digit" }),
    };
    for (const cat of topCats) {
      row[CATEGORY_LABELS[cat] ?? cat] = m.byCategory[cat] ?? 0;
    }
    row["Other"] = Object.entries(m.byCategory)
      .filter(([c]) => !topCats.includes(c))
      .reduce((s, [, v]) => s + v, 0);
    return row;
  });

  // Pie chart data
  const pieData = (data?.byCategory ?? []).map((c) => ({
    name: CATEGORY_LABELS[c.category] ?? c.category,
    value: c.total,
    color: CATEGORY_COLORS[c.category] ?? "#d1d5db",
  }));

  // Category bar chart
  const categoryBarData = (data?.byCategory ?? []).map((c) => ({
    name: `${c.accountCode} ${CATEGORY_LABELS[c.category] ?? c.category}`,
    Amount: c.total,
    color: CATEGORY_COLORS[c.category] ?? "#d1d5db",
  }));

  // Project horizontal bar
  const projectBarData = (data?.byProject ?? []).slice(0, 8).map((p) => ({
    name: p.projectName.length > 22 ? p.projectName.slice(0, 22) + "…" : p.projectName,
    Amount: p.total,
    invoices: p.invoiceCount,
  }));

  // Regular vs Caja Chica donut
  const splitData = data ? [
    { name: "Regular", value: data.totals.regular, color: "#f97316" },
    { name: "Caja Chica", value: data.totals.cajaChica, color: "#a855f7" },
  ].filter((d) => d.value > 0) : [];

  const hasCajaChica = (data?.totals.cajaChica ?? 0) > 0;

  return (
    <div className="p-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold tracking-widest text-orange-500 uppercase mb-1">Pre-Accounting</p>
          <h1 className="text-2xl font-bold text-gray-900">Expense Visualizations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data ? `${fmtFull(data.totals.grand)} total · ${data.invoiceCount} invoices · ${periodLabel(period)}` : "—"}
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors w-fit"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Period tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit mb-8">
        {PERIODS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setPeriod(value)}
            className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${
              period === value ? "bg-white shadow text-orange-600" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : !data || data.invoiceCount === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800">
          No confirmed matched invoices found for this period.
        </div>
      ) : (
        <div className="space-y-6">

          {/* Row 1: Monthly trend (full width) */}
          {monthlyData.length > 1 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="font-semibold text-gray-900 mb-1">Monthly Expense Trend</h2>
              <p className="text-xs text-gray-400 mb-5">Total spend per month, stacked by category</p>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={monthlyData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    {topCats.map((cat) => (
                      <linearGradient key={cat} id={`grad-${cat}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CATEGORY_COLORS[cat]} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={CATEGORY_COLORS[cat]} stopOpacity={0.03} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={55} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                  {topCats.map((cat) => (
                    <Area
                      key={cat}
                      type="monotone"
                      dataKey={CATEGORY_LABELS[cat] ?? cat}
                      stackId="1"
                      stroke={CATEGORY_COLORS[cat]}
                      fill={`url(#grad-${cat})`}
                      strokeWidth={2}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Row 2: Category bar + Pie donut */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Category bar chart */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="font-semibold text-gray-900 mb-1">Spend by Account</h2>
              <p className="text-xs text-gray-400 mb-5">Total expenses per account code</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={categoryBarData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip content={<CurrencyTooltip />} />
                  <Bar dataKey="Amount" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {categoryBarData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie chart */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="font-semibold text-gray-900 mb-1">
                {hasCajaChica ? "Expense Mix" : "Category Distribution"}
              </h2>
              <p className="text-xs text-gray-400 mb-5">
                {hasCajaChica ? "Regular vs petty cash and category breakdown" : "Share of total by category"}
              </p>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => fmtFull(Number(v))}
                      contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="flex flex-col gap-2 flex-shrink-0 min-w-[110px]">
                  {pieData.map((d) => {
                    const pct = data.totals.grand > 0 ? (d.value / data.totals.grand * 100).toFixed(1) : "0";
                    return (
                      <div key={d.name} className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        <div className="min-w-0">
                          <div className="text-xs text-gray-700 font-medium truncate">{d.name}</div>
                          <div className="text-xs text-gray-400">{pct}%</div>
                        </div>
                      </div>
                    );
                  })}
                  {hasCajaChica && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      {splitData.map((d) => {
                        const pct = data.totals.grand > 0 ? (d.value / data.totals.grand * 100).toFixed(1) : "0";
                        return (
                          <div key={d.name} className="flex items-center gap-2 mb-1">
                            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                            <div className="text-xs text-gray-500">{d.name}: {pct}%</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: By Project bar (only if multiple projects) */}
          {projectBarData.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="font-semibold text-gray-900 mb-1">Spend by Project</h2>
              <p className="text-xs text-gray-400 mb-5">Total expenses allocated per project</p>
              <ResponsiveContainer width="100%" height={Math.max(160, projectBarData.length * 52)}>
                <BarChart data={projectBarData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={140} />
                  <Tooltip
                    formatter={(v) => fmtFull(Number(v))}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                  />
                  <Bar dataKey="Amount" fill="#6366f1" radius={[0, 4, 4, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Row 4: Caja Chica vs Regular split (only if both exist) */}
          {hasCajaChica && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="font-semibold text-gray-900 mb-1">Regular vs Petty Cash</h2>
              <p className="text-xs text-gray-400 mb-5">Expense split between regular invoices and caja chica</p>
              <div className="flex items-center gap-8">
                <ResponsiveContainer width="40%" height={180}>
                  <PieChart>
                    <Pie data={splitData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                      {splitData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => fmtFull(Number(v))}
                      contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-4">
                  {splitData.map((d) => {
                    const pct = data.totals.grand > 0 ? (d.value / data.totals.grand * 100) : 0;
                    return (
                      <div key={d.name}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                            <span className="text-sm font-medium text-gray-700">{d.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-semibold text-gray-900">{fmtFull(d.value)}</span>
                            <span className="text-xs text-gray-400 ml-2">{pct.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: d.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

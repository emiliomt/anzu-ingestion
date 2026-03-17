"use client";

import { useEffect, useState } from "react";
import { FileText, Clock, AlertTriangle, Zap, TrendingUp, TrendingDown } from "lucide-react";

interface Metrics {
  total: number;
  totalToday: number;
  byChannel: { web: number; email: number; whatsapp: number };
  byStatus: Record<string, number>;
  flagged: number;
  duplicates: number;
  avgConfidence: number | null;
}

export function MetricsPanel() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/metrics");
        const data = await res.json() as Metrics;
        setMetrics(data);
      } catch (err) {
        console.error(err);
      }
    }

    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!metrics) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 sm:p-6 flex-shrink-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 animate-pulse" style={{ border: "1px solid #F1F5F9" }}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 bg-gray-100 rounded-xl" />
            </div>
            <div className="h-7 bg-gray-100 rounded w-1/3 mb-1" />
            <div className="h-3 bg-gray-100 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  const pending = metrics.byStatus?.pending ?? metrics.byStatus?.received ?? 0;
  const confidence = metrics.avgConfidence != null
    ? `${metrics.avgConfidence.toFixed(1)}%`
    : "—";

  const cards = [
    {
      label: "Processed Today",
      value: String(metrics.totalToday),
      sub: `${metrics.total} all time`,
      Icon: FileText,
      color: "#F97316",
      trend: "up" as const,
    },
    {
      label: "Pending",
      value: String(pending),
      sub: pending > 0 ? "Require review" : "All clear",
      Icon: Clock,
      color: "#F59E0B",
      trend: "neutral" as const,
    },
    {
      label: "Exceptions",
      value: String(metrics.flagged),
      sub: metrics.flagged > 0 ? "Require attention" : "All clear",
      Icon: AlertTriangle,
      color: "#EF4444",
      trend: metrics.flagged > 0 ? "down" as const : "up" as const,
    },
    {
      label: "AI Accuracy",
      value: confidence,
      sub: "Avg extraction confidence",
      Icon: Zap,
      color: "#10B981",
      trend: "up" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 sm:p-6 flex-shrink-0">
      {cards.map(({ label, value, sub, Icon, color, trend }) => (
        <div
          key={label}
          className="bg-white rounded-2xl p-4"
          style={{ border: "1px solid #F1F5F9", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-start justify-between mb-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${color}18` }}
            >
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            {trend === "up" && <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />}
            {trend === "down" && <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-0.5" style={{ letterSpacing: "-0.02em" }}>
            {value}
          </div>
          <div className="text-xs text-gray-400">{label}</div>
          <div className="text-xs mt-0.5" style={{ color }}>{sub}</div>
        </div>
      ))}
    </div>
  );
}

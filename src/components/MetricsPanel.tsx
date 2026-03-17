"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Globe, Mail, MessageCircle, Flag, Copy } from "lucide-react";

interface Metrics {
  total: number;
  totalToday: number;
  byChannel: { web: number; email: number; whatsapp: number };
  byStatus: Record<string, number>;
  flagged: number;
  duplicates: number;
  avgConfidence: number | null;
}

interface CardDef {
  label: string;
  value: number;
  Icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  sub?: string;
  warning?: boolean;
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 px-6 py-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
            <div className="flex items-start justify-between mb-3">
              <div className="h-3 bg-gray-100 rounded w-3/4" />
              <div className="w-9 h-9 bg-gray-100 rounded-lg" />
            </div>
            <div className="h-7 bg-gray-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  const cards: CardDef[] = [
    {
      label: "Total Today",
      value: metrics.totalToday,
      Icon: TrendingUp,
      iconColor: "#2563EB",
      iconBg: "#EEF2FF",
      sub: `${metrics.total} all time`,
    },
    {
      label: "Web",
      value: metrics.byChannel.web,
      Icon: Globe,
      iconColor: "#0EA5E9",
      iconBg: "#E0F2FE",
    },
    {
      label: "Email",
      value: metrics.byChannel.email,
      Icon: Mail,
      iconColor: "#F97316",
      iconBg: "#FFF7ED",
    },
    {
      label: "WhatsApp",
      value: metrics.byChannel.whatsapp,
      Icon: MessageCircle,
      iconColor: "#10B981",
      iconBg: "#ECFDF5",
    },
    {
      label: "Flagged",
      value: metrics.flagged,
      Icon: Flag,
      iconColor: "#EF4444",
      iconBg: "#FEE2E2",
      warning: metrics.flagged > 0,
    },
    {
      label: "Duplicates",
      value: metrics.duplicates,
      Icon: Copy,
      iconColor: "#F59E0B",
      iconBg: "#FFFBEB",
      warning: metrics.duplicates > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 px-6 py-4">
      {cards.map(({ label, value, Icon, iconColor, iconBg, sub, warning }) => (
        <div
          key={label}
          className={`bg-white rounded-xl border p-5 transition-shadow hover:shadow-md ${
            warning ? "border-red-200" : "border-gray-200"
          }`}
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-sm text-gray-500">{label}</p>
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: warning ? "#FEE2E2" : iconBg }}
            >
              <Icon style={{ color: warning ? "#EF4444" : iconColor, width: "18px", height: "18px" }} />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
      ))}
    </div>
  );
}

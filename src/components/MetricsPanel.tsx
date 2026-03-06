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
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="h-4 bg-gray-100 rounded mb-2 w-3/4" />
            <div className="h-7 bg-gray-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Total Today",
      value: metrics.totalToday,
      icon: <TrendingUp className="w-4 h-4 text-indigo-500" />,
      sub: `${metrics.total} all time`,
      color: "text-indigo-700",
    },
    {
      label: "Web",
      value: metrics.byChannel.web,
      icon: <Globe className="w-4 h-4 text-sky-500" />,
      color: "text-sky-700",
    },
    {
      label: "Email",
      value: metrics.byChannel.email,
      icon: <Mail className="w-4 h-4 text-orange-500" />,
      color: "text-orange-700",
    },
    {
      label: "WhatsApp",
      value: metrics.byChannel.whatsapp,
      icon: <MessageCircle className="w-4 h-4 text-green-500" />,
      color: "text-green-700",
    },
    {
      label: "Flagged",
      value: metrics.flagged,
      icon: <Flag className="w-4 h-4 text-red-500" />,
      color: "text-red-700",
      warning: metrics.flagged > 0,
    },
    {
      label: "Duplicates",
      value: metrics.duplicates,
      icon: <Copy className="w-4 h-4 text-amber-500" />,
      color: "text-amber-700",
      warning: metrics.duplicates > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`card p-4 ${card.warning ? "border-red-100 bg-red-50" : ""}`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-medium">{card.label}</span>
            {card.icon}
          </div>
          <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
          {card.sub && (
            <div className="text-xs text-gray-400 mt-0.5">{card.sub}</div>
          )}
        </div>
      ))}
    </div>
  );
}

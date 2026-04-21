"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  Clock,
  AlertTriangle,
  Zap,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Gauge,
  Layers3,
} from "lucide-react";

interface Metrics {
  total: number;
  totalToday: number;
  byChannel: { web: number; email: number; whatsapp: number };
  byStatus: Record<string, number>;
  flagged: number;
  duplicates: number;
  avgConfidence: number | null;
  extractedByChannel?: { web: number; email: number; whatsapp: number };
  oldestExtractedAt?: string | null;
  extractedFlaggedCount?: number;
  extractedCount?: number;
  reviewQueueCount?: number;
  processingCount?: number;
  errorCount?: number;
  lowConfidenceCount?: number;
  successRate?: number;
  errorRate?: number;
}

function formatAgeSince(dateIso: string | null | undefined): string {
  if (!dateIso) return "No backlog";
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const diffHours = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  if (diffHours < 1) return "<1h oldest";
  if (diffHours < 24) return `${diffHours}h oldest`;
  const days = Math.floor(diffHours / 24);
  return `${days}d oldest`;
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

  const confidence = metrics.avgConfidence != null ? `${metrics.avgConfidence.toFixed(1)}%` : "—";
  const successRateLabel = metrics.successRate != null ? `${metrics.successRate.toFixed(1)}%` : "—";
  const errorRateLabel = metrics.errorRate != null ? `${metrics.errorRate.toFixed(1)}%` : "—";
  const reviewQueue = metrics.reviewQueueCount ?? metrics.byStatus?.extracted ?? 0;
  const processing = metrics.processingCount ?? metrics.byStatus?.processing ?? 0;
  const lowConfidence = metrics.lowConfidenceCount ?? 0;
  const oldestBacklogLabel = formatAgeSince(metrics.oldestExtractedAt);
  const channels = metrics.byChannel ?? { web: 0, email: 0, whatsapp: 0 };
  const entries = Object.entries(channels) as Array<[keyof typeof channels, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  const [topChannelName, topChannelCount] = entries[0] ?? ["web", 0];
  const dominantChannel = `${topChannelName} ${topChannelCount}`;

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
      label: "Review Queue",
      value: String(reviewQueue),
      sub: oldestBacklogLabel,
      Icon: Clock,
      color: "#F59E0B",
      trend: reviewQueue > 0 ? "down" as const : "up" as const,
    },
    {
      label: "Error Rate",
      value: errorRateLabel,
      sub: `${metrics.errorCount ?? metrics.byStatus?.error ?? 0} failed`,
      Icon: AlertTriangle,
      color: "#EF4444",
      trend: (metrics.errorRate ?? 0) > 10 ? "down" as const : "up" as const,
    },
    {
      label: "AI Confidence",
      value: confidence,
      sub: `${lowConfidence} low-confidence`,
      Icon: Zap,
      color: "#10B981",
      trend: "up" as const,
    },
    {
      label: "Extraction Success",
      value: successRateLabel,
      sub: `${metrics.extractedCount ?? metrics.byStatus?.extracted ?? 0} extracted`,
      Icon: CheckCircle2,
      color: "#0EA5E9",
      trend: (metrics.successRate ?? 0) >= 75 ? "up" as const : "down" as const,
    },
    {
      label: "In Flight",
      value: String(processing),
      sub: processing > 0 ? "Currently processing" : "Idle",
      Icon: Gauge,
      color: "#A855F7",
      trend: processing > 0 ? "neutral" as const : "up" as const,
    },
    {
      label: "Flagged Records",
      value: String(metrics.flagged),
      sub: `${metrics.duplicates} duplicates`,
      Icon: Layers3,
      color: "#F43F5E",
      trend: metrics.flagged > 0 ? "down" as const : "up" as const,
    },
    {
      label: "Top Channel",
      value: dominantChannel,
      sub: `${channels.web + channels.email + channels.whatsapp} today`,
      Icon: TrendingUp,
      color: "#14B8A6",
      trend: "up" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4 p-4 sm:p-6 flex-shrink-0">
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

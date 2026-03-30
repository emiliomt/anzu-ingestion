"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Inbox, ArrowRight, Clock, AlertTriangle, Mail, Globe, MessageCircle } from "lucide-react";

interface Metrics {
  byStatus?: Record<string, number>;
  extractedByChannel?: { web: number; email: number; whatsapp: number };
  oldestExtractedAt?: string | null;
  extractedFlaggedCount?: number;
}

function ageLabel(dateStr: string): { label: string; isOld: boolean } {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffHours / 24;

  if (diffDays >= 1) {
    const d = Math.floor(diffDays);
    return { label: `${d} day${d > 1 ? "s" : ""} ago`, isOld: diffDays > 2 };
  }
  const h = Math.floor(diffHours);
  return { label: `${h} hour${h !== 1 ? "s" : ""} ago`, isOld: false };
}

export function UnsortedQueueWidget() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    fetch("/api/metrics")
      .then((r) => r.json())
      .then(setMetrics)
      .catch(() => {});
  }, []);

  if (!metrics) return null;

  const count = metrics.byStatus?.extracted ?? 0;
  if (count === 0) return null;

  const channels = metrics.extractedByChannel ?? { web: 0, email: 0, whatsapp: 0 };
  const flagged = metrics.extractedFlaggedCount ?? 0;
  const oldest = metrics.oldestExtractedAt ? ageLabel(metrics.oldestExtractedAt) : null;

  return (
    <div className="mx-4 sm:mx-6 mb-4">
      <div
        className="rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-4"
        style={{
          background: "linear-gradient(135deg, #fdf4ff 0%, #ede9fe 100%)",
          borderColor: "#c4b5fd",
        }}
      >
        {/* Icon + main message */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Inbox className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-violet-900">
                {count} invoice{count !== 1 ? "s" : ""} need review
              </span>
              {oldest && (
                <span
                  className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                    oldest.isOld
                      ? "bg-amber-100 text-amber-700"
                      : "bg-violet-100 text-violet-600"
                  }`}
                >
                  {oldest.isOld && <AlertTriangle className="w-3 h-3" />}
                  <Clock className="w-3 h-3" />
                  Oldest: {oldest.label}
                </span>
              )}
            </div>
            {/* Channel pills */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {channels.web > 0 && (
                <span className="flex items-center gap-1 text-[11px] bg-white/60 text-violet-700 px-2 py-0.5 rounded-full border border-violet-200">
                  <Globe className="w-3 h-3" /> {channels.web} web
                </span>
              )}
              {channels.email > 0 && (
                <span className="flex items-center gap-1 text-[11px] bg-white/60 text-violet-700 px-2 py-0.5 rounded-full border border-violet-200">
                  <Mail className="w-3 h-3" /> {channels.email} email
                </span>
              )}
              {channels.whatsapp > 0 && (
                <span className="flex items-center gap-1 text-[11px] bg-white/60 text-violet-700 px-2 py-0.5 rounded-full border border-violet-200">
                  <MessageCircle className="w-3 h-3" /> {channels.whatsapp} WhatsApp
                </span>
              )}
              {flagged > 0 && (
                <span className="flex items-center gap-1 text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                  <AlertTriangle className="w-3 h-3" /> {flagged} flagged
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action button */}
        <Link
          href="/admin/invoices?status=extracted"
          className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors flex-shrink-0 self-start sm:self-auto"
        >
          Review All
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

"use client";

import type { InvoiceStatus } from "@/types/invoice";

const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; classes: string }
> = {
  received: {
    label: "Received",
    classes: "bg-blue-50 text-blue-700 border border-blue-100",
  },
  processing: {
    label: "Processing",
    classes: "bg-yellow-50 text-yellow-700 border border-yellow-100",
  },
  extracted: {
    label: "Extracted",
    classes: "bg-purple-50 text-purple-700 border border-purple-100",
  },
  pending_approval: {
    label: "Pending Approval",
    classes: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  reviewed: {
    label: "Reviewed",
    classes: "bg-indigo-50 text-indigo-700 border border-indigo-100",
  },
  complete: {
    label: "Complete",
    classes: "bg-green-50 text-green-700 border border-green-100",
  },
  error: {
    label: "Error",
    classes: "bg-red-50 text-red-700 border border-red-100",
  },
};

export function StatusBadge({ status }: { status: string }) {
  const config =
    STATUS_CONFIG[status as InvoiceStatus] ?? STATUS_CONFIG.received;
  return (
    <span className={`badge ${config.classes}`}>
      {status === "processing" && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse mr-1" />
      )}
      {config.label}
    </span>
  );
}

const CHANNEL_CONFIG: Record<string, { label: string; classes: string; icon: string }> = {
  web: {
    label: "Web",
    classes: "bg-sky-50 text-sky-700 border border-sky-100",
    icon: "🌐",
  },
  email: {
    label: "Email",
    classes: "bg-orange-50 text-orange-700 border border-orange-100",
    icon: "✉️",
  },
  whatsapp: {
    label: "WhatsApp",
    classes: "bg-green-50 text-green-700 border border-green-100",
    icon: "💬",
  },
};

export function ChannelBadge({ channel }: { channel: string }) {
  const config = CHANNEL_CONFIG[channel] ?? CHANNEL_CONFIG.web;
  return (
    <span className={`badge ${config.classes}`}>
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </span>
  );
}

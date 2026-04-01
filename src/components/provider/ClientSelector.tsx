"use client";

/**
 * ClientSelector — Provider upload client chooser
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders a dropdown of Organizations that have accepted this provider.
 * The provider MUST select a client before they can upload an invoice.
 *
 * Fetches from: GET /api/provider/my-clients
 */

import { useEffect, useState } from "react";
import { Building2, ChevronDown, CheckCircle2, AlertCircle } from "lucide-react";

type ClientOrg = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  country: string;
};

interface ClientSelectorProps {
  /** Called whenever the selected organizationId changes */
  onChange: (organizationId: string | null) => void;
  disabled?: boolean;
}

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  Enterprise: { bg: "#FEF3C7", text: "#92400E" },
  Growth:     { bg: "#DCFCE7", text: "#166534" },
  Starter:    { bg: "#EFF6FF", text: "#1D4ED8" },
};

export function ClientSelector({ onChange, disabled }: ClientSelectorProps) {
  const [clients, setClients]   = useState<ClientOrg[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/provider/my-clients")
      .then((r) => r.json() as Promise<{ clients: ClientOrg[]; error?: string }>)
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setClients(data.clients ?? []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setSelected(val);
    onChange(val || null);
  }

  const selectedClient = clients.find((c) => c.id === selected);
  const planStyle = selectedClient
    ? PLAN_COLORS[selectedClient.plan] ?? PLAN_COLORS.Starter
    : null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
        <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-orange-500 animate-spin" />
        Loading your connected clients…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-2 text-sm text-red-500">
        <AlertCircle className="w-4 h-4 shrink-0" />
        {error}
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div
        className="flex items-start gap-3 p-4 rounded-xl border text-sm"
        style={{ background: "#FFF7ED", borderColor: "#FED7AA", color: "#9A3412" }}
      >
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">No connected clients yet</p>
          <p className="text-xs mt-0.5">
            A company must invite you before you can submit invoices to them.
            Check your{" "}
            <a href="/provider/connections" className="underline font-medium">
              pending invitations
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-gray-700">
        Submit invoice to <span className="text-red-500">*</span>
      </label>

      <div className="relative">
        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <select
          value={selected}
          onChange={handleChange}
          disabled={disabled}
          required
          className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontFamily: "var(--font-body)" }}
        >
          <option value="">— Select a client company —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.country})
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      </div>

      {/* Selected client info badge */}
      {selectedClient && planStyle && (
        <div className="flex items-center gap-2 text-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="text-gray-600">Invoice will be submitted to</span>
          <strong className="text-gray-900">{selectedClient.name}</strong>
          <span
            className="px-1.5 py-0.5 rounded-md font-medium"
            style={{ background: planStyle.bg, color: planStyle.text }}
          >
            {selectedClient.plan}
          </span>
        </div>
      )}
    </div>
  );
}

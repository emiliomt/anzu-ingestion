"use client";

/**
 * /provider/connections — Provider client connection management
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows pending invitations from clients and accepted connections.
 * Providers can accept/view invitations here.
 */

import { useEffect, useState } from "react";
import { Link2, CheckCircle2, Clock, XCircle, Building2 } from "lucide-react";

type Connection = {
  id: string;
  status: "pending" | "accepted" | "rejected";
  invitedAt: string;
  acceptedAt?: string | null;
  organization: {
    name: string;
    plan: string;
    country: string;
    slug: string;
  };
};

const STATUS_STYLES = {
  pending:  { color: "#D97706", bg: "#FFFBEB", label: "Pending",  icon: Clock },
  accepted: { color: "#059669", bg: "#ECFDF5", label: "Connected", icon: CheckCircle2 },
  rejected: { color: "#DC2626", bg: "#FEF2F2", label: "Rejected", icon: XCircle },
};

const PLAN_COLORS: Record<string, { bg: string; text: string }> = {
  Enterprise: { bg: "#FEF3C7", text: "#92400E" },
  Growth:     { bg: "#DCFCE7", text: "#166534" },
  Starter:    { bg: "#EFF6FF", text: "#1D4ED8" },
};

export default function ProviderConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading]         = useState(true);
  const [accepting, setAccepting]     = useState<string | null>(null);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => { fetchConnections(); }, []);

  async function fetchConnections() {
    setLoading(true);
    try {
      // Fetch the provider's own connections via the provider invoices API
      // We repurpose: providers see their connections via a dedicated endpoint
      const res = await fetch("/api/provider/my-clients");
      // Get ALL connections (accepted + pending) from a combined view
      // Pending ones need to be fetched separately
      const allRes = await fetch("/api/provider/connections");
      if (allRes.ok) {
        const data = await allRes.json() as { connections: Connection[] };
        setConnections(data.connections ?? []);
      } else {
        // Fallback: show only accepted from my-clients
        const data = await res.json() as { clients: Connection["organization"][] };
        setConnections((data.clients ?? []).map((c) => ({
          id: c.slug,
          status: "accepted" as const,
          invitedAt: "",
          organization: c,
        })));
      }
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(connectionId: string) {
    setAccepting(connectionId);
    setError(null);
    try {
      const res = await fetch("/api/provider/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      const data = await res.json() as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to accept invitation");
        return;
      }
      await fetchConnections();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setAccepting(null);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-6 border-b bg-white border-gray-100">
        <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
          Client Connections
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage your connections to client companies. Accept invitations to start submitting invoices.
        </p>
      </div>

      <div className="px-6 py-6 max-w-2xl">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
            <div className="w-4 h-4 rounded-full border-2 border-gray-200 border-t-orange-500 animate-spin" />
            Loading connections…
          </div>
        ) : connections.length === 0 ? (
          <div className="text-center py-12">
            <Link2 className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No connections yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Ask a company to invite you by sharing your registered email address.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map((conn) => {
              const style = STATUS_STYLES[conn.status] ?? STATUS_STYLES.pending;
              const Icon = style.icon;
              const planStyle = PLAN_COLORS[conn.organization.plan] ?? PLAN_COLORS.Starter;

              return (
                <div
                  key={conn.id}
                  className="bg-white rounded-xl border border-gray-100 p-4"
                  style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "#F0F9FF" }}
                      >
                        <Building2 className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {conn.organization.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className="text-xs font-medium px-1.5 py-0.5 rounded"
                            style={{ background: planStyle.bg, color: planStyle.text }}
                          >
                            {conn.organization.plan}
                          </span>
                          <span className="text-xs text-gray-400">{conn.organization.country}</span>
                        </div>
                        {conn.invitedAt && (
                          <p className="text-xs text-gray-400 mt-1">
                            Invited {new Date(conn.invitedAt).toLocaleDateString("es-CO")}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Status badge */}
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ background: style.bg, color: style.color }}
                      >
                        <Icon className="w-3 h-3" />
                        {style.label}
                      </span>

                      {/* Accept button for pending */}
                      {conn.status === "pending" && (
                        <button
                          onClick={() => handleAccept(conn.id)}
                          disabled={accepting === conn.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                          style={{ background: "linear-gradient(135deg, #10B981, #059669)" }}
                        >
                          {accepting === conn.id ? "Accepting…" : "Accept"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

/**
 * /admin/audit-log — Immutable audit trail viewer (ADMIN only)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState, useCallback } from "react";
import { Shield, Search, Filter } from "lucide-react";

type AuditEntry = {
  id: string;
  actorClerkUserId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  organizationId?: string;
  metadata?: string;
  ipAddress?: string;
  createdAt: string;
  organization?: { name: string; slug: string } | null;
};

type Pagination = { page: number; limit: number; total: number; pages: number };

const ROLE_COLORS: Record<string, string> = {
  ADMIN:    "#7C3AED",
  CLIENT:   "#EA580C",
  PROVIDER: "#0369A1",
};

export default function AuditLogPage() {
  const [entries, setEntries]     = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading]     = useState(true);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (actionFilter) params.set("action", actionFilter);
      const res = await fetch(`/api/admin/audit-log?${params}`);
      const data = await res.json() as { entries: AuditEntry[]; pagination: Pagination };
      setEntries(data.entries ?? []);
      setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => { void loadEntries(); }, [loadEntries]);

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      e.action.toLowerCase().includes(s) ||
      e.actorClerkUserId.toLowerCase().includes(s) ||
      (e.organization?.name ?? "").toLowerCase().includes(s) ||
      (e.resourceId ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-6 border-b bg-white border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#F5F3FF" }}>
            <Shield className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
              Audit Log
            </h1>
            <p className="text-sm text-gray-500">
              Immutable record of all sensitive system actions.
              {pagination && ` ${pagination.total.toLocaleString()} total entries.`}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 border-b bg-white border-gray-100">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by action, user ID, org..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-gray-400" />
            <input
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              placeholder="Filter action..."
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300 w-40"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-4">
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
            <div className="w-4 h-4 rounded-full border-2 border-gray-200 border-t-purple-500 animate-spin" />
            Loading audit log…
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden text-xs">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100" style={{ background: "#F8FAFC" }}>
                  {["Timestamp", "Actor", "Role", "Action", "Resource", "Organization", "IP"].map((h) => (
                    <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString("es-CO")}
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-600 max-w-[120px] truncate" title={entry.actorClerkUserId}>
                      {entry.actorClerkUserId.slice(0, 12)}…
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="px-1.5 py-0.5 rounded text-xs font-semibold"
                        style={{ background: `${ROLE_COLORS[entry.actorRole] ?? "#64748B"}20`, color: ROLE_COLORS[entry.actorRole] ?? "#64748B" }}
                      >
                        {entry.actorRole}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-gray-700">{entry.action}</td>
                    <td className="px-3 py-2 text-gray-600">
                      <span className="font-medium">{entry.resourceType}</span>
                      {entry.resourceId && (
                        <span className="ml-1 text-gray-400 font-mono">
                          {entry.resourceId.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {entry.organization?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-400 font-mono">
                      {entry.ipAddress ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
              Previous
            </button>
            <span className="text-xs text-gray-500">Page {page} of {pagination.pages}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.pages}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

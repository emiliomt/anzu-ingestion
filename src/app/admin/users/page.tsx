"use client";

/**
 * /admin/users — User management (ADMIN only)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useState } from "react";
import { Users, Shield, Building2, Truck } from "lucide-react";

type UserProfile = {
  id: string;
  clerkUserId: string;
  role: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  createdAt: string;
  organization?: { id: string; name: string; plan: string; slug: string } | null;
  providerConnections: { status: string; organization: { name: string } }[];
};

const ROLE_STYLES: Record<string, { color: string; bg: string; icon: typeof Shield }> = {
  ADMIN:    { color: "#7C3AED", bg: "#F5F3FF", icon: Shield },
  CLIENT:   { color: "#EA580C", bg: "#FFF7ED", icon: Building2 },
  PROVIDER: { color: "#0369A1", bg: "#E0F2FE", icon: Truck },
};

export default function AdminUsersPage() {
  const [users, setUsers]     = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json() as Promise<{ users: UserProfile[] }>)
      .then((data) => setUsers(data.users ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleRoleChange(clerkUserId: string, newRole: string, orgId?: string) {
    setSaving(clerkUserId);
    try {
      await fetch(`/api/admin/users/${clerkUserId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole, organizationId: orgId }),
      });
      // Re-fetch
      const res = await fetch("/api/admin/users");
      const data = await res.json() as { users: UserProfile[] };
      setUsers(data.users ?? []);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-6 border-b bg-white border-gray-100">
        <h1 className="text-xl font-bold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
          Users
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage user roles across all organizations. {users.length} total users.
        </p>
      </div>

      <div className="px-6 py-6">
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
            <div className="w-4 h-4 rounded-full border-2 border-gray-200 border-t-orange-500 animate-spin" />
            Loading users…
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100" style={{ background: "#F8FAFC" }}>
                  {["User", "Role", "Organization", "Connections", "Joined", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => {
                  const roleStyle = ROLE_STYLES[u.role] ?? ROLE_STYLES.CLIENT;
                  const Icon = roleStyle.icon;
                  const acceptedConns = u.providerConnections.filter((c) => c.status === "accepted");
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">
                          {u.firstName || u.lastName
                            ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
                            : "—"}
                        </p>
                        <p className="text-xs text-gray-400">{u.email ?? u.clerkUserId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: roleStyle.bg, color: roleStyle.color }}
                        >
                          <Icon className="w-3 h-3" />
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {u.organization ? (
                          <span>{u.organization.name}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {acceptedConns.length > 0
                          ? acceptedConns.map((c) => c.organization.name).join(", ")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(u.createdAt).toLocaleDateString("es-CO")}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          defaultValue={u.role}
                          disabled={saving === u.clerkUserId}
                          onChange={(e) => handleRoleChange(u.clerkUserId, e.target.value, u.organization?.id)}
                          className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-orange-300 disabled:opacity-50"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="CLIENT">CLIENT</option>
                          <option value="PROVIDER">PROVIDER</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="px-6 pb-6">
        <div className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{ background: "#FFFBEB", color: "#92400E", border: "1px solid #FEF3C7" }}>
          <Users className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Role changes take effect on the user&apos;s next page load. For CLIENT role changes,
            ensure the user is assigned to the correct organization first.
          </p>
        </div>
      </div>
    </div>
  );
}

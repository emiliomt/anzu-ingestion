// Anzu Dynamics — Role-Based Access Control (RBAC)
// Built on Clerk Organization membership roles.
//
// Roles:
//   org:admin        → Full access: invoices, settings, credentials, billing, user management
//   org:finance_user → Finance User: read + upload invoices only (no settings/billing)
//   org:member       → Alias for org:finance_user (Clerk's default org role)
//
// Setup in Clerk dashboard:
//   1. Enable Organizations in your Clerk application settings
//   2. Create custom role "finance_user" (key: finance_user)
//   3. Assign roles when inviting members to an organization
//
// Usage in API routes:
//   const { orgId, role } = await requireAdmin();           // admin-only
//   const { orgId, role } = await requireAnyRole();         // any org member
//   const { orgId }       = await requireOrgId();           // org required, any role

import { auth } from "@clerk/nextjs/server";

// ── Role constants ─────────────────────────────────────────────────────────────

export const ROLES = {
  ADMIN:        "org:admin"        as const,
  FINANCE_USER: "org:finance_user" as const,
  MEMBER:       "org:member"       as const,
} satisfies Record<string, `org:${string}`>;

export type OrgRole = (typeof ROLES)[keyof typeof ROLES];

// All roles that belong to a live Clerk organization
const ALL_ORG_ROLES: OrgRole[] = [ROLES.ADMIN, ROLES.FINANCE_USER, ROLES.MEMBER];

// ── Error class ────────────────────────────────────────────────────────────────

export class RoleError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 401 | 403 | 404 = 403
  ) {
    super(message);
    this.name = "RoleError";
  }
}

// ── Core role guards ───────────────────────────────────────────────────────────

/**
 * Requires an authenticated user with an active Clerk organization.
 * Returns the orgId, userId, and current role.
 * Throws RoleError if the user has no active org or the role is not in allowedRoles.
 */
export async function requireRole(
  allowedRoles: OrgRole[] = ALL_ORG_ROLES
): Promise<{ orgId: string; userId: string; role: OrgRole }> {
  const session = await auth();
  const { userId, orgId, orgRole } = session;

  if (!userId) throw new RoleError("Authentication required", 401);
  if (!orgId)  throw new RoleError("No active organization — create or select one first", 403);

  const role = (orgRole ?? ROLES.MEMBER) as OrgRole;

  if (!allowedRoles.includes(role)) {
    throw new RoleError(
      `Your role '${role}' does not have permission for this action. ` +
      `Required: ${allowedRoles.join(" or ")}`,
      403
    );
  }

  return { orgId, userId, role };
}

/**
 * Requires the user to be an org:admin.
 * Use for settings, billing, credential vault, user management endpoints.
 */
export async function requireAdmin(): Promise<{
  orgId: string;
  userId: string;
  role: OrgRole;
}> {
  return requireRole([ROLES.ADMIN]);
}

/**
 * Requires any org member (admin or finance user).
 * Use for invoice read + upload endpoints.
 */
export async function requireAnyRole(): Promise<{
  orgId: string;
  userId: string;
  role: OrgRole;
}> {
  return requireRole(ALL_ORG_ROLES);
}

// ── Permission helpers (use in server components + client guards) ──────────────

/** Can manage settings, ERP credentials, billing */
export function canManageSettings(role: OrgRole | null): boolean {
  return role === ROLES.ADMIN;
}

/** Can upload and read invoices */
export function canUploadInvoices(role: OrgRole | null): boolean {
  return role !== null; // all org members
}

/** Can review, approve, or delete invoices */
export function canEditInvoices(role: OrgRole | null): boolean {
  return role === ROLES.ADMIN;
}

/** Can manage matching, projects, purchase orders */
export function canManageMatching(role: OrgRole | null): boolean {
  return role === ROLES.ADMIN;
}

/** Can manage users, invite members */
export function canManageUsers(role: OrgRole | null): boolean {
  return role === ROLES.ADMIN;
}

// ── Response helpers ───────────────────────────────────────────────────────────

/**
 * Wraps an API route handler with RoleError → HTTP response conversion.
 * Prevents unhandled RoleError exceptions from returning 500 instead of 401/403.
 *
 * @example
 * export const GET = withRoleGuard(async () => { ... });
 */
export function withRoleGuard<T>(
  handler: () => Promise<T>
): () => Promise<T | Response> {
  return async () => {
    try {
      return await handler();
    } catch (err) {
      if (err instanceof RoleError) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: err.statusCode,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw err;
    }
  };
}

// ── Human-readable role labels (for UI) ───────────────────────────────────────

export const ROLE_LABELS: Record<string, string> = {
  [ROLES.ADMIN]:        "Administrator",
  [ROLES.FINANCE_USER]: "Finance User",
  [ROLES.MEMBER]:       "Finance User",
};

export function getRoleLabel(role: string | null): string {
  if (!role) return "No role";
  return ROLE_LABELS[role] ?? role;
}

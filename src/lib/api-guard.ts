/**
 * Anzu Dynamics — API Route Guard (withGuard HOF)
 * ─────────────────────────────────────────────────────────────────────────────
 * A Higher-Order Function that wraps Next.js API route handlers with:
 *   1. Authentication check (Clerk session)
 *   2. Role-based access control
 *   3. Tenant isolation (organizationId must be set for CLIENT-org-required routes)
 *   4. Optional automatic AuditLog entry
 *   5. Consistent error responses
 *
 * Usage:
 *   export const GET = withGuard(
 *     async (req, ctx) => {
 *       const filter = getTenantFilter(ctx);
 *       const invoices = await prisma.invoice.findMany({ where: filter });
 *       return NextResponse.json(invoices);
 *     },
 *     { roles: ["CLIENT", "ADMIN"] }
 *   );
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getSessionContext,
  unauthorized,
  forbidden,
  AuthorizationError,
  writeAuditLog,
  type SessionContext,
} from "@/lib/auth";
import { hasPermission, type Permission, type UserRole } from "@/lib/permissions";

export type GuardOptions = {
  /**
   * Roles that are allowed to call this handler.
   * At least one role from this list must match the caller's role.
   */
  roles: UserRole[];

  /**
   * If true, the caller must have a non-null organizationId.
   * Use for endpoints that are always org-scoped (e.g. CLIENT-only data).
   * ADMIN callers are exempt from this check.
   */
  requireOrg?: boolean;

  /**
   * Optional additional permission check from the permissions matrix.
   * Checked after the role check.
   */
  permission?: Permission;

  /**
   * If provided, an AuditLog row is written for every successful call.
   * Format: "invoice.list" | "invoice.delete" | "erp.export" etc.
   */
  auditAction?: string;

  /**
   * Resource type for the audit log (e.g. "Invoice", "Organization").
   * Defaults to "Unknown" if auditAction is set but resourceType is not.
   */
  auditResourceType?: string;
};

type RouteHandler<T = Record<string, string>> = (
  req: NextRequest,
  ctx: SessionContext,
  params?: T
) => Promise<NextResponse>;

/**
 * Wraps a Next.js API route handler with authentication, RBAC, and tenant guards.
 *
 * @param handler  The route handler function — receives (req, sessionCtx, params)
 * @param options  Guard configuration (roles, requireOrg, permission, audit)
 * @returns        A Next.js-compatible route handler
 */
export function withGuard<T = Record<string, string>>(
  handler: RouteHandler<T>,
  options: GuardOptions
): (req: NextRequest, context?: { params?: T }) => Promise<NextResponse> {
  return async (req: NextRequest, context?: { params?: T }) => {
    // ── 1. Authentication ────────────────────────────────────────────────────
    let ctx: SessionContext | null;
    try {
      ctx = await getSessionContext();
    } catch {
      return unauthorized("Failed to validate session");
    }

    if (!ctx) {
      return unauthorized();
    }

    // ── 2. Role check ────────────────────────────────────────────────────────
    if (!options.roles.includes(ctx.role)) {
      return forbidden(
        `This endpoint requires one of the following roles: ${options.roles.join(", ")}`
      );
    }

    // ── 3. Org check ─────────────────────────────────────────────────────────
    // ADMIN users are exempt — they can operate across all tenants.
    if (options.requireOrg && ctx.role !== "ADMIN" && !ctx.organizationId) {
      return forbidden("An active organization is required for this operation");
    }

    // ── 4. Permission check ──────────────────────────────────────────────────
    if (options.permission && !hasPermission(ctx.role, options.permission)) {
      return forbidden(`Missing permission: ${options.permission}`);
    }

    // ── 5. Execute handler ───────────────────────────────────────────────────
    try {
      const result = await handler(req, ctx, context?.params);

      // ── 6. Audit log (only on successful responses) ──────────────────────
      if (options.auditAction && result.status < 400) {
        writeAuditLog(
          ctx,
          options.auditAction,
          options.auditResourceType ?? "Unknown",
          undefined,
          { method: req.method, path: req.nextUrl?.pathname },
          req
        ).catch(console.error); // non-blocking — never fail the request for audit errors
      }

      return result;
    } catch (err) {
      // ── Handle known authorization errors ───────────────────────────────
      if (err instanceof AuthorizationError) {
        return err.statusCode === 401 ? unauthorized(err.message) : forbidden(err.message);
      }
      // Re-throw unknown errors for the framework to handle
      throw err;
    }
  };
}

// ── Convenience Wrappers ──────────────────────────────────────────────────────

/** Guard preset for ADMIN-only routes. */
export function adminOnly<T = Record<string, string>>(
  handler: RouteHandler<T>,
  auditAction?: string
) {
  return withGuard(handler, {
    roles: ["ADMIN"],
    auditAction,
    auditResourceType: auditAction?.split(".")[0],
  });
}

/** Guard preset for CLIENT + ADMIN routes with org isolation. */
export function clientOrAdmin<T = Record<string, string>>(
  handler: RouteHandler<T>,
  auditAction?: string
) {
  return withGuard(handler, {
    roles: ["CLIENT", "ADMIN"],
    requireOrg: true,
    auditAction,
    auditResourceType: auditAction?.split(".")[0],
  });
}

/** Guard preset for PROVIDER-only routes. */
export function providerOnly<T = Record<string, string>>(
  handler: RouteHandler<T>,
  auditAction?: string
) {
  return withGuard(handler, {
    roles: ["PROVIDER"],
    auditAction,
    auditResourceType: auditAction?.split(".")[0],
  });
}

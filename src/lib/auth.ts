/**
 * Anzu Dynamics — Core Auth & Session Context Library
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides session context helpers, role guards, and tenant isolation utilities
 * for use in API route handlers and Server Components.
 *
 * Architecture:
 * - Clerk handles authentication (JWT verification, sessions, MFA)
 * - UserProfile table binds Clerk userId → role + organizationId
 * - Role is also stored in Clerk publicMetadata.role for fast middleware checks
 * - Tenant isolation: every DB query for CLIENT/PROVIDER includes organizationId filter
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { UserProfile, Organization } from "@prisma/client";
import { hasPermission, type Permission, type UserRole } from "@/lib/permissions";

// ── Session Context ───────────────────────────────────────────────────────────

export type SessionContext = {
  clerkUserId: string;
  role: UserRole;
  organizationId: string | null;
  userProfile: UserProfile;
  organization: Organization | null;
};

/**
 * Builds a full session context for the current request.
 * Reads Clerk auth, then fetches the UserProfile + Organization from the DB.
 * Returns null if the user is not authenticated or has no UserProfile yet.
 *
 * Usage in API routes:
 *   const ctx = await getSessionContext();
 *   if (!ctx) return unauthorized();
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  const { userId } = auth();
  if (!userId) return null;

  const profile = await prisma.userProfile.findUnique({
    where: { clerkUserId: userId },
    include: { organization: true },
  });

  if (!profile) return null;

  return {
    clerkUserId: userId,
    role: profile.role as UserRole,
    organizationId: profile.organizationId,
    userProfile: profile,
    organization: profile.organization,
  };
}

// ── Standard Error Responses ──────────────────────────────────────────────────

export function unauthorized(message = "Authentication required") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Insufficient permissions") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function notFound(message = "Resource not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

// ── Role Guard Helpers ────────────────────────────────────────────────────────

/** Throws a 403 response if the context role is not ADMIN. */
export function requireAdmin(ctx: SessionContext): void {
  if (ctx.role !== "ADMIN") {
    throw new AuthorizationError("Admin access required", 403);
  }
}

/** Throws a 403 response if the context role is not CLIENT. */
export function requireClient(ctx: SessionContext): void {
  if (ctx.role !== "CLIENT") {
    throw new AuthorizationError("Client access required", 403);
  }
}

/** Throws a 403 response if the context role is not PROVIDER. */
export function requireProvider(ctx: SessionContext): void {
  if (ctx.role !== "PROVIDER") {
    throw new AuthorizationError("Provider access required", 403);
  }
}

/** Throws 403 if the user is a CLIENT trying to access a different org's data. */
export function requireTenantAccess(ctx: SessionContext, targetOrgId: string): void {
  if (ctx.role === "ADMIN") return; // Admins see all
  if (ctx.role === "CLIENT" && ctx.organizationId === targetOrgId) return;
  throw new AuthorizationError("Access to this organization is not permitted", 403);
}

/** Checks a named permission from the permissions matrix. */
export function requirePermission(ctx: SessionContext, permission: Permission): void {
  if (!hasPermission(ctx.role, permission)) {
    throw new AuthorizationError(
      `Permission '${permission}' required for this action`,
      403
    );
  }
}

// ── Tenant-Scoped Query Filter ────────────────────────────────────────────────

/**
 * Returns the Prisma `where` clause fragment for tenant isolation.
 *
 * - ADMIN: returns {} (no filter — sees all tenants)
 * - CLIENT: returns { organizationId: ctx.organizationId }
 * - PROVIDER: returns {} (providers have their own per-upload filtering logic)
 *
 * Usage:
 *   const tenantFilter = getTenantFilter(ctx);
 *   const invoices = await prisma.invoice.findMany({ where: { ...tenantFilter, status } });
 */
export function getTenantFilter(ctx: SessionContext): { organizationId?: string } {
  if (ctx.role === "ADMIN") return {};
  if (ctx.role === "CLIENT" && ctx.organizationId) {
    return { organizationId: ctx.organizationId };
  }
  // PROVIDER should use per-resource filtering — this is a safeguard
  return { organizationId: "__none__" }; // forces empty result for safety
}

// ── Provider Helpers ──────────────────────────────────────────────────────────

/**
 * Returns the list of Organizations that have accepted this provider.
 * Used to populate the Client Selector dropdown in the provider upload form.
 */
export async function getProviderApprovedOrgs(clerkUserId: string): Promise<Organization[]> {
  const profile = await prisma.userProfile.findUnique({
    where: { clerkUserId },
  });
  if (!profile) return [];

  const connections = await prisma.providerOrganizationConnection.findMany({
    where: {
      providerProfileId: profile.id,
      status: "accepted",
    },
    include: { organization: true },
  });

  return connections.map((c) => c.organization);
}

/**
 * Validates that a provider has an accepted connection to the specified org.
 * Used in /api/upload to block unauthorized tenant targeting.
 */
export async function validateProviderOrgAccess(
  clerkUserId: string,
  organizationId: string
): Promise<boolean> {
  const profile = await prisma.userProfile.findUnique({
    where: { clerkUserId },
  });
  if (!profile) return false;

  const connection = await prisma.providerOrganizationConnection.findFirst({
    where: {
      providerProfileId: profile.id,
      organizationId,
      status: "accepted",
    },
  });

  return connection !== null;
}

// ── Audit Logging ─────────────────────────────────────────────────────────────

/**
 * Writes an immutable audit log entry for a sensitive action.
 * Call this from API handlers for invoice mutations, role changes, ERP exports.
 */
export async function writeAuditLog(
  ctx: SessionContext,
  action: string,
  resourceType: string,
  resourceId?: string,
  metadata?: Record<string, unknown>,
  req?: NextRequest
): Promise<void> {
  const ipAddress =
    req?.headers.get("x-forwarded-for") ??
    req?.headers.get("x-real-ip") ??
    undefined;

  await prisma.auditLog.create({
    data: {
      actorClerkUserId: ctx.clerkUserId,
      actorRole: ctx.role,
      action,
      resourceType,
      resourceId: resourceId ?? null,
      organizationId: ctx.organizationId,
      metadata: metadata ? JSON.stringify(metadata) : null,
      ipAddress: ipAddress ?? null,
    },
  });
}

// ── Internal Error Class ──────────────────────────────────────────────────────

export class AuthorizationError extends Error {
  constructor(
    public message: string,
    public statusCode: 401 | 403 = 403
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

// ── Clerk Metadata Helpers ────────────────────────────────────────────────────

/**
 * Reads the role from Clerk's publicMetadata.
 * Used in middleware (Edge Runtime) where DB access is not available.
 * The canonical role lives in UserProfile.role; this is a fast cache.
 */
export function getRoleFromClaims(
  sessionClaims: Record<string, unknown> | null | undefined
): UserRole | null {
  const role = (sessionClaims as { publicMetadata?: { role?: string } } | null)
    ?.publicMetadata?.role;
  if (role === "ADMIN" || role === "CLIENT" || role === "PROVIDER") return role;
  return null;
}

/**
 * Determines the home route for a given role.
 * Used for post-login redirects and unauthorized-access redirects.
 */
export function getRoleHome(role: UserRole | null): string {
  switch (role) {
    case "ADMIN":    return "/admin";
    case "CLIENT":   return "/client";
    case "PROVIDER": return "/provider";
    default:         return "/setup";
  }
}

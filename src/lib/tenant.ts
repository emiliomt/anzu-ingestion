// Anzu Dynamics — Multi-Tenant Context Utilities
// Extracts the current Clerk Organization ID and provides Prisma query scoping helpers.
// Every DB query on tenant-scoped models MUST go through withOrg() or requireOrgId().
//
// orgId resolution order:
//   1. auth().orgId  — normal case (Clerk JWT has been refreshed with active org)
//   2. x-anzu-org-id header — fallback injected by middleware when JWT lacks orgId
//      (happens when Clerk's allowed-origins isn't configured for this domain)

import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";

/**
 * Returns the current Clerk organizationId.
 * Throws a descriptive error (caught by Next.js error boundary) if no org is active.
 * Use in API routes and server components that require tenant isolation.
 */
export async function requireOrgId(): Promise<string> {
  const { orgId } = await auth();
  if (orgId) return orgId;

  // Fallback: middleware-injected header (users whose Clerk JWT lacks orgId)
  const h = await headers();
  const fallback = h.get("x-anzu-org-id");
  if (fallback) return fallback;

  throw new Error(
    "No active Clerk organization. The user must belong to (or create) an organization. " +
    "Redirect to /onboarding to create one."
  );
}

/**
 * Returns the current Clerk organizationId or null.
 * Use when tenant context is optional (e.g. legacy single-tenant admin routes).
 */
export async function getOrgId(): Promise<string | null> {
  const { orgId } = await auth();
  if (orgId) return orgId;

  const h = await headers();
  return h.get("x-anzu-org-id") ?? null;
}

/**
 * Returns the current Clerk userId (authenticated user, not org-specific).
 * Throws if no user session.
 */
export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

/**
 * Merges `organizationId` into a Prisma `where` clause.
 * Ensures all tenant-scoped queries are correctly filtered.
 *
 * @example
 *   const invoices = await prisma.invoice.findMany({
 *     where: withOrg(orgId, { status: "extracted" }),
 *   });
 */
export function withOrg<T extends object>(
  orgId: string,
  where?: T
): { organizationId: string } & T {
  return { organizationId: orgId, ...(where ?? ({} as T)) };
}

/**
 * Merges `organizationId` into a Prisma create/update `data` object.
 *
 * @example
 *   await prisma.invoice.create({ data: orgData(orgId, { referenceNo: "INV-001", ... }) });
 */
export function orgData<T extends object>(
  orgId: string,
  data: T
): { organizationId: string } & T {
  return { organizationId: orgId, ...data };
}

/**
 * Type guard: returns true if the given org ID matches the required org.
 * Used to prevent cross-tenant data access in API handlers.
 */
export function isSameTenant(
  recordOrgId: string | null | undefined,
  requestOrgId: string
): boolean {
  return recordOrgId === requestOrgId;
}

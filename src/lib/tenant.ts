// Anzu Dynamics — Multi-Tenant Context Utilities
// Extracts the current Clerk Organization ID and provides Prisma query scoping helpers.
// Every DB query on tenant-scoped models MUST go through withOrg() or requireOrgId().
//
// Company context: Anzu automates invoice lifecycle for Mexico (CFDI) and Colombia
// (Factura Electrónica). Each client company is an isolated tenant via Clerk Orgs.

import { auth } from "@clerk/nextjs/server";

/**
 * Returns the current Clerk organizationId.
 * Throws a descriptive error (caught by Next.js error boundary) if no org is active.
 * Use in API routes and server components that require tenant isolation.
 */
export async function requireOrgId(): Promise<string> {
  const { orgId } = await auth();
  if (!orgId) {
    throw new Error(
      "No active Clerk organization. The user must belong to (or create) an organization. " +
      "Redirect to /dashboard/onboarding to create one."
    );
  }
  return orgId;
}

/**
 * Returns the current Clerk organizationId or null.
 * Use when tenant context is optional (e.g. legacy single-tenant admin routes).
 */
export async function getOrgId(): Promise<string | null> {
  const { orgId } = await auth();
  return orgId ?? null;
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

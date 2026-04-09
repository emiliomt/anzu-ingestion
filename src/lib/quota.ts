// Anzu Dynamics — Plan Quota Enforcement
// Checks how many invoices an org has processed this calendar month against
// the limit for their current plan (demo / starter / growth / enterprise).
//
// PLAN_QUOTAS:  demo=25, starter=500, growth=3_000, enterprise=Infinity
// Quota resets on the 1st of each month (UTC).

import { prisma } from "./prisma";
import { PLAN_QUOTAS, type Plan } from "./stripe";

export interface QuotaStatus {
  allowed:    boolean;
  used:       number;
  limit:      number;
  plan:       Plan;
  resetAt:    string; // ISO date of next quota reset (1st of next month)
}

/** Returns the start of the current calendar month (UTC midnight). */
function currentMonthStart(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Returns the 1st of next month as an ISO date string. */
function nextMonthStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
}

/**
 * Checks the invoice quota for the given org.
 *
 * @throws never — quota errors are returned as `allowed: false`, not thrown.
 */
export async function checkQuota(orgId: string): Promise<QuotaStatus> {
  const [subscription, used] = await Promise.all([
    prisma.subscription.findUnique({ where: { organizationId: orgId } }),
    prisma.invoice.count({
      where: {
        organizationId: orgId,
        submittedAt: { gte: currentMonthStart() },
      },
    }),
  ]);

  const plan  = (subscription?.plan ?? "demo") as Plan;
  const limit = PLAN_QUOTAS[plan] ?? PLAN_QUOTAS.demo;

  return {
    allowed: used < limit,
    used,
    limit,
    plan,
    resetAt: nextMonthStart(),
  };
}

/**
 * Same as checkQuota but for orgs that don't require Clerk auth
 * (e.g. anonymous vendor-portal uploads whose orgId is null).
 * Always returns allowed=true for null org — quota only applies to
 * authenticated tenants.
 */
export async function checkQuotaOrNull(orgId: string | null | undefined): Promise<QuotaStatus> {
  if (!orgId) {
    return { allowed: true, used: 0, limit: Infinity, plan: "enterprise", resetAt: nextMonthStart() };
  }
  return checkQuota(orgId);
}

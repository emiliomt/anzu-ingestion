/**
 * Plan-based feature gating for API routes.
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps a route handler and returns 403 if the org's plan doesn't include
 * the requested feature. ADMIN role always bypasses plan checks.
 *
 * Usage:
 *   export const GET = withPlanFeature("matching", async (req) => { ... });
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { hasPlanFeature, type SubscriptionPlan } from "@/lib/permissions";

type RouteHandler = (req: NextRequest, ctx?: unknown) => Promise<NextResponse> | NextResponse;

export function withPlanFeature(feature: string, handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, routeCtx?: unknown) => {
    const ctx = await getSessionContext();

    // Not authenticated
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ADMIN bypasses all plan checks
    if (ctx.role === "ADMIN") {
      return handler(req, routeCtx);
    }

    const plan = (ctx.organization?.plan ?? "Starter") as SubscriptionPlan;

    if (!hasPlanFeature(plan, feature)) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      return NextResponse.json(
        {
          error: `This feature requires a higher plan. Your current plan is ${plan}.`,
          feature,
          currentPlan: plan,
          upgradeUrl: `${appUrl}/client/billing`,
        },
        { status: 403 }
      );
    }

    return handler(req, routeCtx);
  };
}

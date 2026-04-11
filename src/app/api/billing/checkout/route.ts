// Anzu Dynamics — Stripe Checkout Session
// POST /api/billing/checkout — creates a Stripe Checkout Session for plan upgrades.
// Requires admin role. Returns { url } for client-side redirect.
//
// Flow: Demo org → choose plan → Stripe checkout (30-day trial) → webhook → subscription updated

import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, RoleError } from "@/lib/roles";
import { stripe, isBillingEnabled, PLAN_PRICE_IDS } from "@/lib/stripe";

export const dynamic = "force-dynamic";

const VALID_PLANS = ["starter", "growth", "enterprise"] as const;
type CheckoutPlan = (typeof VALID_PLANS)[number];

export async function POST(req: NextRequest) {
  try {
    if (!isBillingEnabled()) {
      return NextResponse.json(
        { error: "Billing is not configured on this server. Contact support to upgrade your plan." },
        { status: 501 }
      );
    }

    const { orgId, userId } = await requireAdmin();

    const body = (await req.json()) as { plan?: string };
    const plan = body.plan as CheckoutPlan;

    if (!VALID_PLANS.includes(plan)) {
      return NextResponse.json(
        { error: "Invalid plan. Choose starter, growth, or enterprise." },
        { status: 400 }
      );
    }

    const priceId = PLAN_PRICE_IDS[plan];
    if (!priceId) {
      return NextResponse.json(
        { error: `Price ID for plan "${plan}" is not configured. Set STRIPE_PRICE_${plan.toUpperCase()} in your environment.` },
        { status: 501 }
      );
    }

    // Find or create Stripe customer for this org
    let subscription = await prisma.subscription.findUnique({
      where: { organizationId: orgId },
    });

    let customerId = subscription?.stripeCustomerId ?? null;

    if (!customerId) {
      const client = await clerkClient();
      const org = await client.organizations.getOrganization({ organizationId: orgId });

      const customer = await stripe.customers.create({
        name:     org.name,
        metadata: { organizationId: orgId, clerkUserId: userId },
      });
      customerId = customer.id;

      // Upsert so we always have a record to attach the customer ID to
      await prisma.subscription.upsert({
        where:  { organizationId: orgId },
        update: { stripeCustomerId: customerId },
        create: {
          organizationId:  orgId,
          stripeCustomerId: customerId,
          plan:   "demo",
          status: "active",
        },
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer:  customerId,
      mode:      "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // 30-day free trial — no charge until trial ends
      subscription_data: {
        trial_period_days: 30,
        metadata: { organizationId: orgId, plan },
      },
      metadata: { organizationId: orgId, plan },
      allow_promotion_codes: true,
      success_url: `${appUrl}/settings?tab=billing&checkout=success`,
      cancel_url:  `${appUrl}/settings?tab=billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (err instanceof RoleError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[billing/checkout POST]", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}

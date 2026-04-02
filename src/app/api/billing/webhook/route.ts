/**
 * POST /api/billing/webhook
 * ─────────────────────────────────────────────────────────────────────────────
 * Stripe webhook handler. Must receive the raw request body (not parsed).
 *
 * Handled events:
 *   checkout.session.completed     → activate subscription, update plan
 *   customer.subscription.updated  → sync plan change / status
 *   customer.subscription.deleted  → downgrade to Starter, cancel
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe, getPlanFromPriceId } from "@/lib/stripe";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[Billing Webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig ?? "", secret);
  } catch (err) {
    console.error("[Billing Webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const orgId = session.metadata?.organizationId;
        const plan  = session.metadata?.plan;
        if (!orgId || !plan) break;

        await prisma.organization.update({
          where: { id: orgId },
          data: {
            plan,
            stripeSubscriptionId: session.subscription as string,
            subscriptionStatus: "active",
          },
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.organizationId;
        if (!orgId) break;

        // Get plan from the first price item
        const priceId = sub.items.data[0]?.price?.id;
        const plan = priceId ? (getPlanFromPriceId(priceId) ?? undefined) : undefined;

        await prisma.organization.update({
          where: { id: orgId },
          data: {
            ...(plan ? { plan } : {}),
            subscriptionStatus: sub.status,
            stripeSubscriptionId: sub.id,
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const orgId = sub.metadata?.organizationId;
        if (!orgId) break;

        await prisma.organization.update({
          where: { id: orgId },
          data: { plan: "Starter", subscriptionStatus: "canceled", stripeSubscriptionId: null },
        });
        break;
      }

      default:
        // Ignore unhandled events
        break;
    }
  } catch (err) {
    console.error(`[Billing Webhook] Error processing ${event.type}:`, err);
    return NextResponse.json({ error: "Processing error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

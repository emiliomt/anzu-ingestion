// Anzu Dynamics — Stripe Billing Webhook
// POST /api/billing/webhook — verifies Stripe signature and updates the
// Subscription record in response to billing lifecycle events.
//
// Events handled:
//   checkout.session.completed     → create/update subscription with customer ID
//   customer.subscription.updated  → update plan, status, period end
//   customer.subscription.deleted  → mark subscription canceled
//   invoice.payment_failed         → mark subscription past_due

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe, isBillingEnabled, STRIPE_WEBHOOK_SECRET, PLAN_PRICE_IDS, type Plan } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Stripe sends raw bytes; we must NOT parse the body before verifying.
export const runtime = "nodejs";

function priceIdToPlan(priceId: string): Plan {
  for (const [plan, id] of Object.entries(PLAN_PRICE_IDS)) {
    if (id && id === priceId) return plan as Plan;
  }
  return "starter"; // default fallback
}

export async function POST(request: NextRequest) {
  if (!isBillingEnabled()) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 501 });
  }

  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("[billing/webhook] STRIPE_WEBHOOK_SECRET is not set — cannot verify events");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 501 });
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event;
  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[billing/webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as {
          customer: string;
          subscription: string;
          metadata?: { organizationId?: string };
        };

        const organizationId = session.metadata?.organizationId;
        if (!organizationId) {
          console.warn("[billing/webhook] checkout.session.completed missing organizationId in metadata");
          break;
        }

        // Fetch the subscription to get plan info
        const stripeSub = await stripe.subscriptions.retrieve(session.subscription);
        const priceId = stripeSub.items.data[0]?.price.id ?? "";
        const plan = priceIdToPlan(priceId);

        await prisma.subscription.upsert({
          where: { organizationId },
          create: {
            organizationId,
            stripeCustomerId: session.customer,
            stripeSubId: session.subscription,
            plan,
            status: "active",
            currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          },
          update: {
            stripeCustomerId: session.customer,
            stripeSubId: session.subscription,
            plan,
            status: "active",
            currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
          },
        });

        console.log(`[billing/webhook] ✓ Checkout completed for org ${organizationId} → plan ${plan}`);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as {
          id: string;
          customer: string;
          status: string;
          current_period_end: number;
          items: { data: Array<{ price: { id: string } }> };
        };

        const priceId = sub.items.data[0]?.price.id ?? "";
        const plan = priceIdToPlan(priceId);
        const status = sub.status === "active" ? "active"
          : sub.status === "past_due" ? "past_due"
          : sub.status === "trialing" ? "trialing"
          : "canceled";

        const updated = await prisma.subscription.updateMany({
          where: { stripeSubId: sub.id },
          data: {
            plan,
            status,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          },
        });

        console.log(`[billing/webhook] ✓ Subscription updated → ${plan} / ${status} (${updated.count} rows)`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as { id: string };

        const updated = await prisma.subscription.updateMany({
          where: { stripeSubId: sub.id },
          data: { status: "canceled" },
        });

        console.log(`[billing/webhook] ✓ Subscription canceled (${updated.count} rows)`);
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as { subscription: string };

        const updated = await prisma.subscription.updateMany({
          where: { stripeSubId: inv.subscription },
          data: { status: "past_due" },
        });

        console.log(`[billing/webhook] ✓ Payment failed → past_due (${updated.count} rows)`);
        break;
      }

      default:
        // Unhandled event — not an error, Stripe sends many event types
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[billing/webhook] Error processing event:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

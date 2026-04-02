/**
 * POST /api/billing/checkout
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates a Stripe Checkout session for a plan subscription.
 * CLIENT role only. Returns { url } for client-side redirect.
 *
 * Body: { plan: "Starter" | "Growth" | "Enterprise" }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionContext } from "@/lib/auth";
import { stripe, getStripePriceId } from "@/lib/stripe";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CheckoutSchema = z.object({
  plan: z.enum(["Starter", "Growth", "Enterprise"]),
});

export async function POST(req: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const org = ctx.organization;
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 400 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const priceId = getStripePriceId(parsed.data.plan);
  if (!priceId) {
    return NextResponse.json({ error: "Stripe price not configured for this plan" }, { status: 500 });
  }

  // Create or retrieve Stripe customer
  let customerId = org.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: ctx.userProfile.email ?? undefined,
      name: org.name,
      metadata: { organizationId: org.id, slug: org.slug },
    });
    customerId = customer.id;
    await prisma.organization.update({
      where: { id: org.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/client/billing?success=1`,
    cancel_url:  `${appUrl}/client/billing?canceled=1`,
    metadata: { organizationId: org.id, plan: parsed.data.plan },
    subscription_data: {
      metadata: { organizationId: org.id, plan: parsed.data.plan },
    },
  });

  return NextResponse.json({ url: session.url });
}

// Anzu Dynamics — Stripe Customer Portal
// POST /api/billing/portal — creates a Stripe Billing Portal session and
// returns its URL. The client redirects the browser to that URL.
//
// Requires STRIPE_SECRET_KEY to be set. If billing is not configured,
// returns 501 so the UI can show a "contact us" fallback.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, RoleError } from "@/lib/roles";
import { stripe, isBillingEnabled } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    if (!isBillingEnabled()) {
      return NextResponse.json(
        { error: "Billing is not configured on this server. Contact support to upgrade your plan." },
        { status: 501 }
      );
    }

    const { orgId } = await requireAdmin();

    const subscription = await prisma.subscription.findUnique({
      where: { organizationId: orgId },
    });

    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found. Complete your first payment to access the customer portal." },
        { status: 404 }
      );
    }

    const returnUrl =
      (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000") + "/settings?tab=billing";

    const session = await stripe.billingPortal.sessions.create({
      customer:   subscription.stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (err instanceof RoleError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[billing/portal POST]", err);
    return NextResponse.json({ error: "Failed to create billing portal session" }, { status: 500 });
  }
}

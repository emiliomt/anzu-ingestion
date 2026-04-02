/**
 * POST /api/billing/portal
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates a Stripe Customer Portal session for self-serve billing management
 * (upgrade, downgrade, cancel, update payment method).
 * Returns { url } for client-side redirect.
 */

import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const org = ctx.organization;
  if (!org?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account found. Please start a subscription first." },
      { status: 400 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${appUrl}/client/billing`,
  });

  return NextResponse.json({ url: session.url });
}

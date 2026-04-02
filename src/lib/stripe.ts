import Stripe from "stripe";
import type { SubscriptionPlan } from "@/lib/permissions";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2026-03-25.dahlia",
});

/** Map a plan to the Stripe Price ID from env vars */
export function getStripePriceId(plan: SubscriptionPlan): string | null {
  switch (plan) {
    case "Starter":    return process.env.STRIPE_PRICE_STARTER ?? null;
    case "Growth":     return process.env.STRIPE_PRICE_GROWTH ?? null;
    case "Enterprise": return process.env.STRIPE_PRICE_ENTERPRISE ?? null;
  }
}

/** Map a Stripe Price ID back to a plan name */
export function getPlanFromPriceId(priceId: string): SubscriptionPlan | null {
  if (priceId === process.env.STRIPE_PRICE_STARTER)    return "Starter";
  if (priceId === process.env.STRIPE_PRICE_GROWTH)     return "Growth";
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return "Enterprise";
  return null;
}

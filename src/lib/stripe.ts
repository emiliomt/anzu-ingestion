// Anzu Dynamics — Stripe Client Singleton
// Manages billing subscriptions for the multi-tenant SaaS.
// Plans: Demo (free), Starter ($990/mo), Growth ($2,490/mo), Enterprise (custom).
// Stripe webhook handler lives at /api/billing/webhook (Step 6).

import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";

if (!STRIPE_SECRET_KEY && process.env.NODE_ENV === "production") {
  console.warn(
    "[stripe] STRIPE_SECRET_KEY is not set — billing is disabled. " +
    "Set the key in your environment to enable subscriptions."
  );
}

/** Stripe API client — singleton for server-side use only (never import in client components) */
export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-11-20.acacia",
  typescript: true,
  appInfo: {
    name:    "Anzu Dynamics",
    version: "2.0.0",
    url:     process.env.NEXT_PUBLIC_APP_URL ?? "https://app.anzudynamics.com",
  },
});

// ── Plan → Stripe Price ID mapping ────────────────────────────────────────────
// Set these env vars in your Stripe dashboard (test mode for demos).
// Products: Starter / Growth / Enterprise (match the /pricing page tiers).

export const PLAN_PRICE_IDS = {
  starter:    process.env.STRIPE_PRICE_STARTER    ?? "",
  growth:     process.env.STRIPE_PRICE_GROWTH     ?? "",
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? "",
} as const;

export type Plan = keyof typeof PLAN_PRICE_IDS | "demo";

// ── Monthly invoice limits per plan ──────────────────────────────────────────
export const PLAN_QUOTAS: Record<Plan, number> = {
  demo:       25,        // 25 invoices — enough for live demos
  starter:    500,
  growth:     3_000,
  enterprise: Infinity,
};

// ── Webhook verification secret ──────────────────────────────────────────────
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";

// ── Helper: check if billing is configured ───────────────────────────────────
export function isBillingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

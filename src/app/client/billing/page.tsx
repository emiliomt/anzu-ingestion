"use client";

/**
 * /client/billing — Subscription management for CLIENT users
 */

import { useEffect, useState } from "react";
import { CreditCard, Zap, Star, Crown, CheckCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { useSearchParams } from "next/navigation";

interface BillingInfo {
  plan: string;
  subscriptionStatus: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  orgName: string;
}

const PLAN_INFO = {
  Starter: {
    icon: Zap,
    color: "#6B7280",
    features: ["Invoice ingestion (web + email)", "Vendor portal", "Basic CSV export", "30-day history"],
  },
  Growth: {
    icon: Star,
    color: "#F97316",
    features: ["Everything in Starter", "WhatsApp ingestion", "Invoice matching", "Caja chica", "ERP export (SINCO)", "Pre-accounting", "Custom fields", "Security checks"],
  },
  Enterprise: {
    icon: Crown,
    color: "#8B5CF6",
    features: ["Everything in Growth", "SAP / Contpaqi / Siigo integration", "Advanced reporting", "Multi-user org", "SSO", "Dedicated support"],
  },
} as const;

const PLAN_PRICES: Record<string, string> = {
  Starter:    "$990/mo",
  Growth:     "$2,490/mo",
  Enterprise: "Custom",
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const colors: Record<string, string> = {
    active:   "bg-green-100 text-green-700",
    trialing: "bg-blue-100 text-blue-700",
    past_due: "bg-yellow-100 text-yellow-800",
    canceled: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status === "past_due" && <AlertTriangle className="w-3 h-3" />}
      {status === "active" && <CheckCircle className="w-3 h-3" />}
      {status.replace("_", " ")}
    </span>
  );
}

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const success  = searchParams.get("success")  === "1";
  const canceled = searchParams.get("canceled") === "1";

  useEffect(() => {
    fetch("/api/client/settings")
      .then((r) => r.json())
      .then((d: { org?: BillingInfo }) => { setBilling(d.org ?? null); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleCheckout(plan: string) {
    setActionLoading(`checkout-${plan}`);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const { url, error } = await res.json() as { url?: string; error?: string };
      if (url) { window.location.href = url; return; }
      alert(error ?? "Checkout failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePortal() {
    setActionLoading("portal");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const { url, error } = await res.json() as { url?: string; error?: string };
      if (url) { window.location.href = url; return; }
      alert(error ?? "Could not open billing portal");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentPlan = (billing?.plan ?? "Starter") as keyof typeof PLAN_INFO;
  const planInfo = PLAN_INFO[currentPlan] ?? PLAN_INFO.Starter;
  const PlanIcon = planInfo.icon;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* Flash messages */}
      {success && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Subscription activated! Your plan has been updated.
        </div>
      )}
      {canceled && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Checkout canceled. Your plan was not changed.
        </div>
      )}

      {/* Current plan card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Current Plan</p>
            <div className="flex items-center gap-2">
              <PlanIcon className="w-5 h-5" style={{ color: planInfo.color }} />
              <h2 className="text-xl font-bold text-gray-900">{currentPlan}</h2>
              <StatusBadge status={billing?.subscriptionStatus ?? null} />
            </div>
            <p className="text-sm text-gray-500 mt-1">{billing?.orgName}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-900">{PLAN_PRICES[currentPlan]}</p>
            {billing?.stripeSubscriptionId && (
              <button
                onClick={handlePortal}
                disabled={actionLoading === "portal"}
                className="mt-2 flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium"
              >
                <CreditCard className="w-3 h-3" />
                {actionLoading === "portal" ? "Loading..." : "Manage billing"}
              </button>
            )}
          </div>
        </div>

        {/* Features list */}
        <ul className="mt-4 space-y-1">
          {planInfo.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
              <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Plan comparison / upgrade */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Available Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["Starter", "Growth", "Enterprise"] as const).map((plan) => {
            const info   = PLAN_INFO[plan];
            const Icon   = info.icon;
            const isCurrent = plan === currentPlan;
            return (
              <div
                key={plan}
                className={`rounded-2xl border-2 p-5 ${
                  isCurrent ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4" style={{ color: info.color }} />
                  <span className="font-semibold text-gray-900">{plan}</span>
                  {isCurrent && (
                    <span className="ml-auto text-xs font-medium text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-lg font-bold text-gray-900 mb-3">{PLAN_PRICES[plan]}</p>
                <ul className="space-y-1 mb-4">
                  {info.features.slice(0, 4).map((f) => (
                    <li key={f} className="text-xs text-gray-500 flex items-start gap-1.5">
                      <CheckCircle className="w-3 h-3 text-green-400 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                  {info.features.length > 4 && (
                    <li className="text-xs text-gray-400">+{info.features.length - 4} more</li>
                  )}
                </ul>
                {!isCurrent && (
                  <button
                    onClick={() => handleCheckout(plan)}
                    disabled={!!actionLoading}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
                  >
                    {actionLoading === `checkout-${plan}` ? "Redirecting..." : `Switch to ${plan}`}
                    {actionLoading !== `checkout-${plan}` && <ArrowRight className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

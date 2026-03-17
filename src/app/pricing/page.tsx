"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2, X, ArrowRight, ChevronDown,
  Zap, Shield, Users, Calculator,
} from "lucide-react";
import { AnnouncementBar } from "@/components/landing/AnnouncementBar";
import { MarketingHeader } from "@/components/landing/MarketingHeader";
import { MarketingFooter } from "@/components/landing/MarketingFooter";

/* ── Plans ── */
const plans = [
  {
    name: "Starter",
    price: { monthly: "$990", annual: "$792" },
    currency: "USD/mo",
    desc: "For teams just starting their automation journey",
    invoices: "Up to 500 invoices/month",
    highlight: false,
    features: {
      "Invoice Capture": ["Email, web portal, manual upload", "1 user", "1 legal entity"],
      "AI Extraction": ["OCR + standard LLM", "Basic fields (vendor, date, amount, tax)", "90-day history"],
      "Validation": ["Pre-configured basic rules", "Basic SAT/DIAN validation"],
      "Matching": ["2-way matching (invoice–PO)"],
      "Approvals": ["Simple approval flow (1 level)"],
      "Integrations": ["1 ERP integration (native API)"],
      "Support": ["Email, 48h SLA", "Guided onboarding"],
    },
  },
  {
    name: "Growth",
    price: { monthly: "$2,490", annual: "$1,992" },
    currency: "USD/mo",
    desc: "For mid-size companies with more complex processes",
    invoices: "Up to 3,000 invoices/month",
    highlight: true,
    badge: "Most popular",
    features: {
      "Invoice Capture": ["Everything in Starter +", "WhatsApp, API webhooks", "Up to 10 users", "Multiple entities"],
      "AI Extraction": ["OCR + advanced LLM", "All invoice fields", "Unlimited history", "Per-vendor learning"],
      "Validation": ["Full rules engine", "Advanced SAT/DIAN validation", "Blacklists/whitelists"],
      "Matching": ["2 & 3-way matching (invoice–PO–receipt)", "Configurable tolerances"],
      "Approvals": ["Unlimited multi-level flows", "SLAs and auto-escalations", "WhatsApp/email notifications"],
      "Integrations": ["Multiple ERPs (native API)", "1 RPA connector"],
      "Support": ["Chat & email, 8h SLA", "Dedicated CSM first month"],
    },
  },
  {
    name: "Enterprise",
    price: { monthly: "Custom", annual: "Custom" },
    currency: "",
    desc: "For large enterprises and corporate groups",
    invoices: "Unlimited volume",
    highlight: false,
    features: {
      "Invoice Capture": ["Everything in Growth +", "Unlimited users", "Unlimited entities", "White-label available"],
      "AI Extraction": ["Fine-tuned AI model for your company", "Integration with proprietary documents"],
      "Validation": ["Custom business rules", "GRC/ERM integration"],
      "Matching": ["Custom matching logic", "Advanced multi-currency reconciliation"],
      "Approvals": ["Custom workflow builder", "HR systems integration"],
      "Integrations": ["Unlimited RPA connectors", "SSO / SAML 2.0", "Enterprise API with SLA"],
      "Support": ["99.9% SLA guaranteed", "Dedicated CSM", "24/7 support", "Managed implementation"],
    },
  },
];

/* ── Add-ons ── */
const addons = [
  { name: "Additional RPA Connector", price: "$490/mo", desc: "Per RPA instance for ERPs without API" },
  { name: "Vendor Portal", price: "$190/mo", desc: "Self-service access for your vendors" },
  { name: "Advanced Audit Module", price: "$290/mo", desc: "Compliance reports and DIAN/SAT export" },
  { name: "Workflow Builder Pro", price: "$190/mo", desc: "Visual flow builder with unlimited steps" },
];

/* ── Comparison table ── */
const comparisonRows = [
  { feature: "Invoices/month", starter: "500", growth: "3,000", enterprise: "Unlimited" },
  { feature: "Users", starter: "1", growth: "10", enterprise: "Unlimited" },
  { feature: "Legal entities", starter: "1", growth: "Multiple", enterprise: "Unlimited" },
  { feature: "Email capture", starter: true, growth: true, enterprise: true },
  { feature: "WhatsApp capture", starter: false, growth: true, enterprise: true },
  { feature: "Advanced OCR + AI", starter: false, growth: true, enterprise: true },
  { feature: "3-way matching", starter: false, growth: true, enterprise: true },
  { feature: "Multi-level approvals", starter: false, growth: true, enterprise: true },
  { feature: "Custom validation rules", starter: false, growth: true, enterprise: true },
  { feature: "RPA connectors", starter: "0", growth: "1", enterprise: "Unlimited" },
  { feature: "SSO / SAML", starter: false, growth: false, enterprise: true },
  { feature: "Guaranteed SLA", starter: "—", growth: "99.5%", enterprise: "99.9%" },
  { feature: "Dedicated CSM", starter: false, growth: "Onboarding", enterprise: true },
];

/* ── FAQ ── */
const faqs = [
  { q: "Can I change plans at any time?", a: "Yes, you can upgrade or downgrade at any time. Changes take effect at the next billing cycle." },
  { q: "What happens if I exceed my invoice limit?", a: "We notify you when you reach 80% of your quota. If you exceed it, additional invoices are processed at $0.80 USD each (Starter) or $0.50 USD (Growth)." },
  { q: "Is there a free trial?", a: "Yes, all plans include a 30-day free trial with all features. No credit card required." },
  { q: "What currency do you bill in?", a: "We bill in USD. We accept credit card, SPEI transfer (Mexico) and PSE/bank transfer (Colombia)." },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100">
      <button
        className="w-full flex items-start justify-between gap-4 py-5 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-medium text-gray-900">{q}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 mt-0.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <p className="text-sm text-gray-600 pb-5 leading-relaxed">{a}</p>}
    </div>
  );
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div>
      <AnnouncementBar />
      <MarketingHeader />

      {/* ── Hero ── */}
      <section className="py-16 text-center" style={{ background: "linear-gradient(180deg, #F8FAFC 0%, #fff 100%)" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full mb-5" style={{ background: "#FFF7ED", color: "#F97316" }}>
            <Zap className="w-3 h-3" /> 30-day free trial on all plans
          </span>
          <h1 className="text-gray-900 mb-4" style={{ fontFamily: "var(--font-display)", fontSize: "var(--h1-size)", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Simple, predictable pricing
          </h1>
          <p className="text-gray-600 mb-8 max-w-lg mx-auto" style={{ fontFamily: "var(--font-body)" }}>
            No surprises. No hidden implementation costs. Guaranteed positive ROI in the first quarter.
          </p>

          {/* Monthly / Annual toggle */}
          <div className="inline-flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!annual ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${annual ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
            >
              Annual
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#D1FAE5", color: "#065F46" }}>-20%</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Plan cards ── */}
      <section className="pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-6 border ${plan.highlight ? "shadow-xl shadow-orange-100 border-orange-400" : "border-gray-200 bg-white"}`}
                style={plan.highlight ? { background: "linear-gradient(160deg, #0C1B3A 0%, #1E293B 100%)" } : {}}
              >
                {plan.badge && (
                  <span className="inline-flex text-xs font-bold px-2.5 py-1 rounded-full mb-3" style={{ background: "#F97316", color: "#fff" }}>
                    {plan.badge}
                  </span>
                )}
                <h3 className={`font-bold text-base mb-1 ${plan.highlight ? "text-white" : "text-gray-900"}`}>{plan.name}</h3>
                <p className={`text-xs mb-4 ${plan.highlight ? "text-orange-200" : "text-gray-500"}`}>{plan.desc}</p>
                <div className="flex items-end gap-1 mb-1">
                  <span className={`text-3xl font-bold ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                    {annual ? plan.price.annual : plan.price.monthly}
                  </span>
                  {plan.currency && (
                    <span className={`text-xs mb-1.5 ${plan.highlight ? "text-orange-200" : "text-gray-400"}`}>{plan.currency}</span>
                  )}
                </div>
                <p className={`text-xs mb-5 ${plan.highlight ? "text-orange-300" : "text-gray-400"}`}>{plan.invoices}</p>

                <Link
                  href="/demo"
                  className={`block text-center py-2.5 rounded-xl text-sm font-semibold mb-6 anzu-btn-cta ${plan.highlight ? "bg-white text-orange-600" : "text-white"}`}
                  style={!plan.highlight ? { background: "linear-gradient(135deg, #F97316, #EA580C)" } : {}}
                >
                  {plan.name === "Enterprise" ? "Talk to Sales" : "Try free for 30 days"}
                </Link>

                <div className="space-y-4">
                  {Object.entries(plan.features).map(([category, items]) => (
                    <div key={category}>
                      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${plan.highlight ? "text-orange-300" : "text-gray-400"}`}>
                        {category}
                      </p>
                      <ul className="space-y-1.5">
                        {(items as string[]).map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${plan.highlight ? "text-emerald-400" : "text-emerald-500"}`} />
                            <span className={`text-xs ${plan.highlight ? "text-blue-100" : "text-gray-600"}`}>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Full comparison table ── */}
      <section className="py-16" style={{ background: "#F8FAFC" }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-gray-900 text-center mb-8" style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Full feature comparison
          </h2>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-4 text-sm font-semibold border-b border-gray-200">
              <div className="px-5 py-3 text-gray-600">Feature</div>
              <div className="px-4 py-3 text-center text-gray-700">Starter</div>
              <div className="px-4 py-3 text-center font-bold" style={{ color: "#F97316", background: "#FFF7ED" }}>Growth</div>
              <div className="px-4 py-3 text-center text-gray-700">Enterprise</div>
            </div>
            {comparisonRows.map((row, i) => (
              <div key={row.feature} className={`grid grid-cols-4 text-sm border-b border-gray-100 last:border-0 ${i % 2 !== 0 ? "bg-gray-50/50" : ""}`}>
                <div className="px-5 py-3 text-gray-700">{row.feature}</div>
                {(["starter", "growth", "enterprise"] as const).map((plan) => (
                  <div key={plan} className={`px-4 py-3 text-center ${plan === "growth" ? "bg-orange-50/40" : ""}`}>
                    {typeof row[plan] === "boolean" ? (
                      row[plan] ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-gray-300 mx-auto" />
                      )
                    ) : (
                      <span className="text-gray-700 text-xs font-medium">{row[plan]}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Add-ons ── */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-gray-900 text-center mb-8" style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Add-on modules
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {addons.map((addon) => (
              <div key={addon.name} className="rounded-xl p-4 border border-gray-200 bg-white anzu-card-hover">
                <div className="font-semibold text-gray-900 text-sm mb-1">{addon.name}</div>
                <div className="font-bold text-sm mb-2" style={{ color: "#F97316" }}>{addon.price}</div>
                <p className="text-xs text-gray-500">{addon.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security badges ── */}
      <section className="py-12 border-y border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-8">
            {[
              { icon: Shield, label: "SOC 2 Type II" },
              { icon: Shield, label: "ISO 27001" },
              { icon: Users, label: "LFPDPPP Certified" },
              { icon: Calculator, label: "DIAN Compliant" },
            ].map((badge) => {
              const Icon = badge.icon;
              return (
                <div key={badge.label} className="flex items-center gap-2 text-gray-500">
                  <Icon className="w-4 h-4" style={{ color: "#F97316" }} />
                  <span className="text-sm font-medium">{badge.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-gray-900 text-center mb-8" style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Pricing questions
          </h2>
          {faqs.map((faq) => <FAQItem key={faq.q} q={faq.q} a={faq.a} />)}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16" style={{ background: "linear-gradient(135deg, #0C1B3A, #1E293B)" }}>
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-white mb-4" style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Not sure which plan to choose?
          </h2>
          <p className="text-gray-300 text-sm mb-6">Our team helps you identify the right plan for your volume and complexity.</p>
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white shadow-lg anzu-btn-cta"
            style={{ background: "linear-gradient(135deg, #F97316, #EA580C)", boxShadow: "0 8px 24px rgba(249,115,22,0.35)" }}
          >
            Talk to an expert <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

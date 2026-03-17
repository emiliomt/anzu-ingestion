"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  FileText, GitMerge, BarChart3,
  LayoutDashboard, Upload, Zap, ArrowRight,
} from "lucide-react";

/* ── IntersectionObserver hook (local copy) ── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

const fadeUp = (visible: boolean, delayMs: number): React.CSSProperties => ({
  opacity: visible ? 1 : 0,
  transform: visible ? "translateY(0)" : "translateY(24px)",
  transition: `opacity 600ms cubic-bezier(0.16,1,0.3,1) ${delayMs}ms, transform 600ms cubic-bezier(0.16,1,0.3,1) ${delayMs}ms`,
  willChange: "transform, opacity",
});

/* ── Product config ── */
const PRODUCTS = [
  {
    id: "importer",
    badge: "Invoice Importer",
    tagline: "Capture & extract every invoice automatically",
    description:
      "Receive invoices via email, web portal, or WhatsApp. OCR + AI extracts fields with 98.5% accuracy, validates against your rules, and posts to your ERP.",
    color: "#4F46E5",
    accentBg: "#EDE9FE",
    borderColor: "rgba(79,70,229,0.20)",
    glowColor: "rgba(79,70,229,0.12)",
    icon: FileText,
    apps: [
      { label: "Admin Dashboard", href: "/admin",  icon: LayoutDashboard },
      { label: "Provider Portal", href: "/portal", icon: Upload },
    ],
    primaryCta: { label: "Open Admin", href: "/admin" },
  },
  {
    id: "matcher",
    badge: "Invoice Matcher",
    tagline: "2/3-way matching against POs and receipts",
    description:
      "Automatically reconcile invoices against purchase orders and goods receipts. AI flags discrepancies, routes exceptions, and closes the period faster.",
    color: "#10B981",
    accentBg: "#ECFDF5",
    borderColor: "rgba(16,185,129,0.20)",
    glowColor: "rgba(16,185,129,0.10)",
    icon: GitMerge,
    apps: [
      { label: "Matcher Dashboard", href: "/matcher", icon: LayoutDashboard },
    ],
    primaryCta: { label: "Open Matcher", href: "/matcher" },
  },
  {
    id: "preaccounting",
    badge: "Pre-Accounting",
    tagline: "P&L preview and expense classification",
    description:
      "Classify expenses by cost center, project and category. See your preliminary P&L in real time, spot anomalies early, and accelerate the accounting close.",
    color: "#EA580C",
    accentBg: "#FFF7ED",
    borderColor: "rgba(234,88,12,0.20)",
    glowColor: "rgba(234,88,12,0.10)",
    icon: BarChart3,
    apps: [
      { label: "Pre-Accounting", href: "/preaccounting", icon: LayoutDashboard },
    ],
    primaryCta: { label: "Open Pre-Accounting", href: "/preaccounting" },
  },
];

export function ProductSuite() {
  const [ref, inView] = useInView(0.1);

  return (
    <section
      id="products"
      style={{ scrollMarginTop: "80px", background: "#F8FAFC" }}
      className="py-16 md:py-24"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div ref={ref} className="text-center mb-14">
          <div style={fadeUp(inView, 0)}>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-4"
              style={{ background: "#FFF7ED", color: "#EA580C", border: "1px solid rgba(234,88,12,0.15)" }}>
              <Zap className="w-3 h-3" />
              Choose your product
            </span>
          </div>
          <h2
            style={{ ...fadeUp(inView, 80), fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", color: "#0C1B3A", lineHeight: 1.15 }}
            className="font-bold mb-4"
          >
            One platform.{" "}
            <span style={{ color: "#F97316" }}>Three specialized apps.</span>
          </h2>
          <p style={{ ...fadeUp(inView, 160), fontFamily: "var(--font-body)", color: "#64748B", maxWidth: "540px", margin: "0 auto", lineHeight: 1.6 }}>
            Each module solves a specific step in your AP workflow — use one or run all three together for end-to-end automation.
          </p>
        </div>

        {/* Product cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PRODUCTS.map((product, i) => {
            const MainIcon = product.icon;
            return (
              <div
                key={product.id}
                style={{
                  ...fadeUp(inView, 240 + i * 100),
                  border: `1px solid ${product.borderColor}`,
                  borderRadius: "16px",
                  background: "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  transition: "box-shadow 200ms ease, transform 200ms ease",
                }}
                className="group/card p-6 hover:-translate-y-1"
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 32px ${product.glowColor}`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                }}
              >
                {/* Badge */}
                <div className="mb-4 flex items-start justify-between">
                  <span
                    className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: product.accentBg, color: product.color }}
                  >
                    {product.badge}
                  </span>
                </div>

                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: product.accentBg }}
                >
                  <MainIcon className="w-6 h-6" style={{ color: product.color }} />
                </div>

                {/* Tagline + description */}
                <h3
                  className="font-bold mb-2"
                  style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem", color: "#0C1B3A", lineHeight: 1.25 }}
                >
                  {product.tagline}
                </h3>
                <p
                  className="text-sm mb-5 flex-1"
                  style={{ fontFamily: "var(--font-body)", color: "#64748B", lineHeight: 1.6 }}
                >
                  {product.description}
                </p>

                {/* Divider */}
                <div className="border-t border-gray-100 mb-4" />

                {/* App chips */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {product.apps.map((app) => {
                    const AppIcon = app.icon;
                    return (
                      <Link
                        key={app.href}
                        href={app.href}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        style={{
                          background: product.accentBg,
                          color: product.color,
                          border: `1px solid ${product.borderColor}`,
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.opacity = "0.8";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLAnchorElement).style.opacity = "1";
                        }}
                      >
                        <AppIcon className="w-3.5 h-3.5" />
                        {app.label}
                        <ArrowRight className="w-3 h-3 opacity-60" />
                      </Link>
                    );
                  })}
                </div>

                {/* Primary CTA */}
                <Link
                  href={product.primaryCta.href}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white anzu-btn-cta"
                  style={{ background: product.color }}
                >
                  {product.primaryCta.label}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

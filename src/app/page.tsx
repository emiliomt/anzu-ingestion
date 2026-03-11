"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Play,
  Star,
  ArrowRight,
  X,
  Sparkles,
  CheckCircle,
  Zap,
  Shield,
  BarChart3,
  FileText,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

/* ─── Announcement Bar ─────────────────────────────────────── */
function AnnouncementBar() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div className="relative bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm py-2.5 px-4 text-center">
      <Sparkles className="inline w-3.5 h-3.5 mr-1.5 mb-0.5" />
      New: Native SAP S/4HANA integration now available.{" "}
      <a href="/portal" className="underline underline-offset-2 font-medium hover:text-blue-100">
        See demo →
      </a>
      <button
        onClick={() => setVisible(false)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ─── Logo ──────────────────────────────────────────────────── */
function AnzuLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
        </svg>
      </div>
      <span className="font-semibold text-base tracking-tight">Anzu Dynamics</span>
    </div>
  );
}

/* ─── Nav ───────────────────────────────────────────────────── */
const NAV_LINKS = [
  { label: "Product", dropdown: true },
  { label: "Solutions", dropdown: true },
  { label: "Integrations", dropdown: false },
  { label: "Resources", dropdown: true },
  { label: "Pricing", dropdown: false },
];

function Nav() {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <AnzuLogo className="text-gray-900" />

        {/* Links */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((l) => (
            <button
              key={l.label}
              className="flex items-center gap-0.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-50 transition-colors"
            >
              {l.label}
              {l.dropdown && <ChevronDown className="w-3.5 h-3.5 ml-0.5 text-gray-400" />}
            </button>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400 border border-gray-200 rounded-full px-3 py-1">
            <span className="font-medium text-gray-600">MX ES</span>
            <span>/</span>
            <span className="text-orange-500 font-medium">US EN</span>
          </div>
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5">
            Sign in
          </Link>
          <Link
            href="/portal"
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-full transition-colors"
          >
            Request Demo
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ─── Hero ──────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="bg-gray-950 text-white py-24 md:py-32 text-center">
      <div className="max-w-4xl mx-auto px-6">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm text-gray-300 mb-8">
          <Sparkles className="w-3.5 h-3.5 text-orange-400" />
          AI for Accounts Payable · Mexico &amp; Colombia
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6 tracking-tight">
          Automate your accounts payable.
          <br />
          <span className="text-orange-500">
            Invoice to ERP, without touching a single field.
          </span>
        </h1>

        {/* Subtext */}
        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10">
          Anzu captures, extracts, validates and reconciles invoices with your ERP –
          automatically. Reduce errors by 92%, accelerate approvals and close the month 4
          days earlier.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link
            href="/portal"
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-7 py-3.5 rounded-full transition-colors text-base"
          >
            Request Personalized Demo <ArrowRight className="w-4 h-4" />
          </Link>
          <button className="flex items-center gap-2 border border-white/20 hover:border-white/40 text-white px-7 py-3.5 rounded-full transition-colors text-base bg-white/5">
            <Play className="w-4 h-4 fill-white" />
            See how it works
          </button>
        </div>

        {/* Stats */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-12 border-t border-white/10 pt-10">
          <div className="text-center">
            <div className="text-3xl font-bold text-white">+120</div>
            <div className="text-sm text-gray-400 mt-1">Active companies</div>
          </div>
          <div className="hidden sm:block w-px h-10 bg-white/10" />
          <div className="text-center">
            <div className="text-3xl font-bold text-white">+2M</div>
            <div className="text-sm text-gray-400 mt-1">Invoices processed/month</div>
          </div>
          <div className="hidden sm:block w-px h-10 bg-white/10" />
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              ))}
              <span className="text-white font-bold ml-1">4.9</span>
              <span className="text-gray-400 text-sm">/5.0</span>
            </div>
            <div className="text-sm text-gray-400">Customer rating</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Product Screenshot ────────────────────────────────────── */
function ProductScreenshot() {
  const invoices = [
    { vendor: "Aceros del Norte SA", ref: "OC-2024-1872", amount: "$245,680 MXN", match: "100%", status: "Matched", statusColor: "text-green-400 bg-green-400/10" },
    { vendor: "Cementos Tolteca", ref: "OC-2024-1871", amount: "$89,200 MXN", match: "94%", status: "Review", statusColor: "text-yellow-400 bg-yellow-400/10" },
    { vendor: "Transportes Frontera", ref: "OC-2024-1868", amount: "$32,450 MXN", match: "76%", status: "Exception", statusColor: "text-red-400 bg-red-400/10" },
    { vendor: "Servicios Integrales MX", ref: "OC-2024-1865", amount: "$156,000 MXN", match: "—", status: "Processing", statusColor: "text-orange-400 bg-orange-400/10" },
  ];

  return (
    <section className="bg-gray-950 pb-20 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Browser frame */}
        <div className="rounded-xl border border-white/10 overflow-hidden shadow-2xl bg-gray-900">
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/50 border-b border-white/5">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <span className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="ml-3 text-xs text-gray-400 font-medium">Anzu — Inbox</span>
          </div>

          {/* Inbox rows */}
          <div className="divide-y divide-white/5">
            {invoices.map((inv) => (
              <div
                key={inv.ref}
                className="flex items-center gap-4 px-6 py-4 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{inv.vendor}</div>
                  <div className="text-xs text-gray-500 font-mono">{inv.ref}</div>
                </div>
                <div className="text-sm font-medium text-gray-300 text-right">{inv.amount}</div>
                <div className="text-sm text-gray-400 w-12 text-right">{inv.match}</div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${inv.statusColor}`}>
                  {inv.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Social Proof ──────────────────────────────────────────── */
const LOGOS = ["Grupo Bimbo", "CEMEX", "Vitro", "Sigma Alimentos", "Gruma", "Axtel", "Arca Continental", "Soriana"];

function SocialProof() {
  return (
    <section className="bg-white py-12 border-y border-gray-100">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-center text-xs font-semibold tracking-widest text-gray-400 uppercase mb-8">
          Leading companies in Mexico and Colombia trust Anzu
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {LOGOS.map((logo) => (
            <span key={logo} className="text-gray-300 font-semibold text-base">
              {logo}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Features ──────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: <FileText className="w-6 h-6 text-orange-500" />,
    title: "OCR + AI Extraction",
    desc: "Automatically extract vendor, amounts, line items and tax from any invoice format — PDF, image, or email attachment.",
  },
  {
    icon: <RefreshCw className="w-6 h-6 text-orange-500" />,
    title: "2/3-Way Matching",
    desc: "Match invoices against purchase orders and goods receipts in real time. Catch discrepancies before they become problems.",
  },
  {
    icon: <AlertTriangle className="w-6 h-6 text-orange-500" />,
    title: "Exception Management",
    desc: "Flag and route exceptions automatically. Your team focuses only on invoices that need human judgment.",
  },
  {
    icon: <CheckCircle className="w-6 h-6 text-orange-500" />,
    title: "Approval Workflows",
    desc: "Configurable approval chains with audit trail. Full visibility into who approved what and when.",
  },
  {
    icon: <BarChart3 className="w-6 h-6 text-orange-500" />,
    title: "ERP Integrations",
    desc: "Native connectors for SAP S/4HANA, Oracle, and Microsoft Dynamics. No middleware required.",
  },
  {
    icon: <Shield className="w-6 h-6 text-orange-500" />,
    title: "Compliance & Audit",
    desc: "Full audit log with CFDI validation for Mexico. Maintain 7 years of records with one click export.",
  },
];

function Features() {
  return (
    <section className="bg-white py-24">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-50 rounded-full text-orange-600 text-xs font-medium mb-4">
            <Zap className="w-3.5 h-3.5" />
            Everything you need
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            From capture to ERP posting,<br />fully automated
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Anzu handles the entire accounts payable cycle so your finance team can focus on
            strategic work instead of manual data entry.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="p-6 rounded-2xl border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all group">
              <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center mb-4 group-hover:bg-orange-100 transition-colors">
                {f.icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA Section ───────────────────────────────────────────── */
function CTASection() {
  return (
    <section className="bg-gray-950 py-24 text-center">
      <div className="max-w-2xl mx-auto px-6">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Close your AP cycle{" "}
          <span className="text-orange-500">without manual effort.</span>
        </h2>
        <p className="text-gray-400 mb-3">Personalized demo in 30 minutes.</p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
          <Link
            href="/portal"
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-7 py-3.5 rounded-full transition-colors"
          >
            Request Demo <ArrowRight className="w-4 h-4" />
          </Link>
          <button className="border border-white/20 hover:border-white/40 text-white px-7 py-3.5 rounded-full transition-colors bg-white/5">
            View Pricing
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-6">
          No credit card · Implementation in &lt;2 weeks · Spanish support
        </p>
      </div>
    </section>
  );
}

/* ─── Footer ────────────────────────────────────────────────── */
const FOOTER_LINKS = {
  Product: ["Invoice Capture", "OCR + AI Extraction", "2/3-Way Matching", "Approvals", "Exceptions", "ERP Integrations"],
  Solutions: ["Construction", "Manufacturing", "Distribution", "Shared Services"],
  Company: ["About", "Security", "Blog", "Case Studies", "Contact"],
};

function Footer() {
  return (
    <footer className="bg-gray-950 border-t border-white/5 text-gray-400">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <AnzuLogo className="text-white mb-4" />
            <p className="text-sm leading-relaxed mb-4">
              Intelligent accounts payable automation for companies in Mexico and Colombia.
              Reduce errors, accelerate closes and maintain full control.
            </p>
            <div className="flex flex-col gap-1 text-xs">
              <span>📍 Mexico City, Mexico · Bogotá, Colombia</span>
              <span>✉️ hello@anzuapp.io</span>
            </div>
            <div className="flex gap-3 mt-4">
              {["in", "𝕏"].map((s) => (
                <button key={s} className="w-8 h-8 rounded-full border border-white/10 hover:border-white/30 flex items-center justify-center text-sm transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(FOOTER_LINKS).map(([col, links]) => (
            <div key={col}>
              <h4 className="text-sm font-semibold text-white mb-4">{col}</h4>
              <ul className="space-y-2.5">
                {links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm hover:text-white transition-colors">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <span>© 2026 Anzu Technologies, S.A.P.I. de C.V. All rights reserved.</span>
          <div className="flex items-center gap-4">
            {["Privacy", "Terms", "Security"].map((l) => (
              <a key={l} href="#" className="hover:text-white transition-colors">
                {l}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <main>
      <AnnouncementBar />
      <Nav />
      <Hero />
      <ProductScreenshot />
      <SocialProof />
      <Features />
      <CTASection />
      <Footer />
    </main>
  );
}

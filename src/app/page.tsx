"use client";

import {
  ArrowRight, Play, CheckCircle2, FileText, GitMerge, AlertTriangle,
  Plug2, TrendingUp, Shield, Zap, BarChart3, ChevronRight,
  Star, Quote, Building2, Factory, Truck, Plus,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { AnnouncementBar } from "@/components/landing/AnnouncementBar";
import { MarketingHeader } from "@/components/landing/MarketingHeader";
import { MarketingFooter } from "@/components/landing/MarketingFooter";
import { ProductSuite } from "@/components/landing/ProductSuite";

/* ── IntersectionObserver hook ── */
function useInView(threshold = 0.4) {
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
  transition: `opacity 500ms cubic-bezier(0.16,1,0.3,1) ${delayMs}ms, transform 500ms cubic-bezier(0.16,1,0.3,1) ${delayMs}ms`,
  willChange: "transform, opacity",
});

/* ── Feature metadata ── */
const FEATURE_META = [
  { icon: FileText,      color: "#F97316", bg: "#FFF7ED" },
  { icon: GitMerge,      color: "#10B981", bg: "#ECFDF5" },
  { icon: CheckCircle2,  color: "#8B5CF6", bg: "#EDE9FE" },
  { icon: AlertTriangle, color: "#F59E0B", bg: "#FFFBEB" },
  { icon: Plug2,         color: "#EF4444", bg: "#FEF2F2" },
  { icon: Shield,        color: "#0C1B3A", bg: "#F1F5F9" },
];

const FEATURE_ITEMS = [
  { title: "Omnichannel Capture",      desc: "Receive invoices via email, web portal, WhatsApp or direct upload. OCR + LLM extracts fields with over 98% accuracy." },
  { title: "2/3-Way Matching",         desc: "Automatic matching against purchase orders and goods receipts. Instantly detects price, quantity and vendor discrepancies." },
  { title: "Approval Workflows",       desc: "Build multi-level flows with SLAs, automatic escalations and notifications. No code, drag and drop." },
  { title: "Exception Management",     desc: "AI suggests resolutions for each type of discrepancy. Integrated vendor communication and full traceability." },
  { title: "ERP/RPA Integrations",     desc: "Native API with SAP, Oracle, Dynamics 365 and NetSuite. For ERPs without API, the RPA connector automates capture directly." },
  { title: "Audit & Compliance",       desc: "Immutable record of every action. Ready for SAT, DIAN and external audits. Configurable retention by policy." },
];

/* ── Industry metadata ── */
const INDUSTRY_META = [
  { icon: Building2, color: "#F59E0B", bg: "#FFFBEB", href: "/solutions/construction" },
  { icon: Factory,   color: "#2563EB", bg: "#EEF2FF", href: "/solutions/manufacturing" },
  { icon: Truck,     color: "#10B981", bg: "#ECFDF5", href: "/solutions/distribution" },
  { icon: BarChart3, color: "#8B5CF6", bg: "#EDE9FE", href: "/solutions/shared-services" },
];

const INDUSTRY_ITEMS = [
  { label: "Construction",    desc: "Retention management, subcontractors and work progress" },
  { label: "Manufacturing",   desc: "WMS integration and production input management" },
  { label: "Distribution",    desc: "High volume, multiple warehouses and approval routes" },
  { label: "Shared Services", desc: "Multi-entity, multi-currency and consolidated reporting" },
];

/* ── Testimonials ── */
const testimonials = [
  {
    name: "Valentina Ríos", role: "Directora de Operaciones",
    company: "Constructora Omega, Bogotá",
    text: "Pasamos de 5 personas procesando facturas manualmente a 1 persona supervisando el sistema. Cerramos el mes 4 días antes.",
    avatar: "VR", color: "#2563EB",
    metrics: [{ label: "↓ Tiempo de ciclo", value: "73%" }, { label: "↑ Facturas/día", value: "8×" }],
  },
  {
    name: "Carlos Mendoza", role: "Controller Corporativo",
    company: "Grupo Industrial del Norte, Monterrey",
    text: "El módulo de excepciones cambió todo. Antes necesitábamos 3 días para resolver una discrepancia. Ahora la IA nos da el contexto y aprobamos en horas.",
    avatar: "CM", color: "#10B981",
    metrics: [{ label: "↓ Tiempo excepción", value: "87%" }, { label: "ROI primer año", value: "22×" }],
  },
  {
    name: "Andrea Salinas", role: "Gerente de Cuentas por Pagar",
    company: "Distribuidora Pacífico, Guadalajara",
    text: "Los proveedores ahora tienen visibilidad del estado de sus facturas en tiempo real. Las disputas bajaron 60%.",
    avatar: "AS", color: "#8B5CF6",
    metrics: [{ label: "↓ Disputas proveedor", value: "60%" }, { label: "↓ Costo/factura", value: "78%" }],
  },
];

/* ── Pricing plans ── */
const PLANS = [
  {
    name: "Starter", price: "$990", currency: "USD/mo",
    desc: "Up to 500 invoices/month", cta: "Try free for 30 days",
    features: ["OCR + AI Extraction", "Basic approval workflows", "1 ERP integration", "Email support"],
  },
  {
    name: "Growth", price: "$2,490", currency: "USD/mo",
    desc: "Up to 3,000 invoices/month", cta: "Request Demo",
    features: ["Everything in Starter", "2/3-way matching", "Advanced validation rules", "Multiple ERPs", "RPA connector 1 instance", "Priority support"],
  },
  {
    name: "Enterprise", price: "Custom", currency: "",
    desc: "Unlimited volume", cta: "Talk to Sales",
    features: ["Everything in Growth", "Unlimited RPA connectors", "SSO / SAML", "99.9% SLA guaranteed", "Dedicated CSM", "Advanced audit"],
  },
];

/* ── FAQ ── */
const FAQ_ITEMS = [
  { q: "How long does Anzu implementation take?",         a: "Most of our clients are processing real invoices in less than 2 weeks. Integration with SAP or Dynamics 365 takes 3–5 business days with our team's support." },
  { q: "Does it work with ERPs that don't have an API?",  a: "Yes. Our RPA connector (browser-based automation) can operate directly on any ERP's interface — legacy or modern — without needing to expose an API." },
  { q: "What happens to my invoice data?",                a: "All data is stored in AWS regions in Mexico or Colombia (based on your configuration). We comply with LFPDPPP and Colombian regulations. Data is never used to train third-party models." },
  { q: "Can I connect multiple legal entities?",          a: "Yes. Anzu supports multi-entity and multi-currency architectures from the Growth plan. You can manage CFDI (Mexico) and Colombian e-invoices in the same platform." },
  { q: "How accurate is the data extraction?",            a: "Our average accuracy exceeds 98.5% on recurring vendor invoices. The system improves over time as it learns your vendors' formats." },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        className="w-full flex items-center justify-between py-4 text-left text-sm font-semibold text-gray-900 hover:text-orange-500 transition-colors gap-4"
        onClick={() => setOpen(!open)}
      >
        <span>{q}</span>
        <Plus className={`w-4 h-4 shrink-0 transition-transform duration-200 ${open ? "rotate-45" : ""}`} style={{ color: "#F97316" }} />
      </button>
      {open && <p className="text-sm text-gray-600 pb-5 leading-relaxed">{a}</p>}
    </div>
  );
}

/* ── Trust bar ── */
function TrustBar() {
  const companies = ["Grupo Bimbo", "CEMEX", "Vitro", "Sigma Alimentos", "Gruma", "Axtel", "Arca Continental", "Soriana"];
  return (
    <section className="py-12 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs text-gray-400 uppercase tracking-widest mb-8">
          Leading companies in Mexico and Colombia trust Anzu
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
          {companies.map((name) => (
            <div key={name} className="text-gray-300 font-semibold text-sm hover:text-gray-500 transition-colors cursor-default select-none">
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Preview row type ── */
type PreviewStatus = "matched" | "review" | "exception" | "processing";

const statusLabel: Record<PreviewStatus, string> = {
  matched:    "✓ Matched",
  review:     "Review",
  exception:  "Exception",
  processing: "Processing",
};

const statusStyle: Record<PreviewStatus, { background: string; color: string }> = {
  matched:    { background: "rgba(16,185,129,0.2)",  color: "#6EE7B7" },
  review:     { background: "rgba(245,158,11,0.2)",  color: "#FCD34D" },
  exception:  { background: "rgba(239,68,68,0.2)",   color: "#FCA5A5" },
  processing: { background: "rgba(249,115,22,0.2)",  color: "#FDBA74" },
};

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const [featuresRef,     featuresVisible]     = useInView(0.15);
  const [stepsRef,        stepsVisible]        = useInView(0.2);
  const [testimonialsRef, testimonialsVisible] = useInView(0.1);

  const previewRows: { vendor: string; amount: string; status: PreviewStatus; po: string; match: string }[] = [
    { vendor: "Aceros del Norte SA",      amount: "$245,680 MXN", status: "matched",    po: "OC-2024-1872", match: "100%" },
    { vendor: "Cementos Tolteca",         amount: "$89,200 MXN",  status: "review",     po: "OC-2024-1871", match: "94%" },
    { vendor: "Transportes Frontera",     amount: "$32,450 MXN",  status: "exception",  po: "OC-2024-1868", match: "76%" },
    { vendor: "Servicios Integrales MX",  amount: "$156,000 MXN", status: "processing", po: "OC-2024-1865", match: "—" },
  ];

  return (
    <div>
      <AnnouncementBar />
      <MarketingHeader />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden anzu-section" style={{ background: "linear-gradient(135deg, #0C1B3A 0%, #1E293B 55%, #0C1B3A 100%)" }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none hidden md:block">
          <div className="absolute top-20 right-10 w-96 h-96 rounded-full opacity-15" style={{ background: "radial-gradient(circle, #F97316, transparent)" }} />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full" style={{ background: "radial-gradient(circle, #10B981, transparent)", opacity: 0.08 }} />
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.2) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6 border anzu-fade-up"
              style={{ background: "rgba(249,115,22,0.15)", borderColor: "rgba(249,115,22,0.35)", color: "#FED7AA", animationDelay: "0ms" }}>
              <Zap className="w-3 h-3" />
              AI for Accounts Payable · Mexico &amp; Colombia
            </div>

            <h1 className="text-white mb-6"
              style={{ fontFamily: "var(--font-display)", fontSize: "var(--h1-size)", fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
              <span className="block anzu-fade-up" style={{ animationDelay: "80ms" }}>
                Automate your accounts payable.
              </span>
              <span className="block anzu-fade-up"
                style={{ background: "linear-gradient(135deg, #FB923C, #F97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animationDelay: "180ms" }}>
                Invoice to ERP, without touching a single field.
              </span>
            </h1>

            <p className="text-gray-300 mb-8 max-w-2xl mx-auto anzu-fade-up"
              style={{ fontFamily: "var(--font-body)", fontSize: "1.2rem", lineHeight: 1.65, animationDelay: "280ms" }}>
              Anzu captures, extracts, validates and reconciles invoices with your ERP — automatically. Reduce errors by 92%, accelerate approvals and close the month 4 days earlier.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 anzu-fade-up" style={{ animationDelay: "380ms" }}>
              <Link href="/demo"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-white shadow-lg anzu-btn-cta"
                style={{ background: "linear-gradient(135deg, #F97316, #EA580C)", boxShadow: "0 8px 24px rgba(249,115,22,0.40)" }}>
                Request Personalized Demo <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/product/invoice-ingestion"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-white border border-white/20 hover:bg-white/10 transition-colors">
                <Play className="w-4 h-4" /> See how it works
              </Link>
            </div>

            {/* Social proof */}
            <div className="flex items-center justify-center gap-6 mt-10 pt-8 border-t border-white/10 anzu-fade-up" style={{ animationDelay: "460ms" }}>
              <div className="text-center">
                <div className="text-white text-xl font-bold">+120</div>
                <div className="text-gray-400 text-xs mt-0.5">Active companies</div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <div className="text-white text-xl font-bold">+2M</div>
                <div className="text-gray-400 text-xs mt-0.5">Invoices processed/month</div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
                <span className="text-white text-sm font-semibold ml-1">4.9</span>
                <span className="text-gray-400 text-xs ml-1">/ 5.0</span>
              </div>
            </div>
          </div>

          {/* Hero preview table */}
          <div className="mt-14 relative max-w-4xl mx-auto anzu-fade-up hidden md:block" style={{ animationDelay: "300ms" }}>
            <div className="rounded-2xl shadow-2xl border border-white/10 overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(12px)" }}>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                <span className="text-gray-400 text-xs ml-2">Anzu — Inbox</span>
              </div>
              <div className="p-4 space-y-2.5">
                {previewRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/5 transition-colors" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(249,115,22,0.25)" }}>
                      <FileText className="w-3.5 h-3.5" style={{ color: "#FDBA74" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-xs font-medium truncate">{row.vendor}</div>
                      <div className="text-gray-400 text-xs">{row.po}</div>
                    </div>
                    <div className="text-white text-xs font-semibold">{row.amount}</div>
                    <div className="text-xs text-gray-400 hidden sm:block w-10 text-right">{row.match}</div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0" style={statusStyle[row.status]}>
                      {statusLabel[row.status]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -left-8 top-8 hidden xl:block animate-float">
              <div className="rounded-xl p-3 border border-white/10 shadow-xl" style={{ background: "rgba(16,185,129,0.15)", backdropFilter: "blur(12px)" }}>
                <div className="text-xs text-emerald-300 mb-0.5">Cycle time</div>
                <div className="text-white font-bold text-lg">-73%</div>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-300 text-xs">vs. manual process</span>
                </div>
              </div>
            </div>
            <div className="absolute -right-8 bottom-12 hidden xl:block animate-float-delay">
              <div className="rounded-xl p-3 border border-white/10 shadow-xl" style={{ background: "rgba(249,115,22,0.18)", backdropFilter: "blur(12px)" }}>
                <div className="text-xs mb-0.5" style={{ color: "#FDBA74" }}>Auto-match</div>
                <div className="text-white font-bold text-lg">98.5%</div>
                <div className="text-xs mt-1" style={{ color: "#FDBA74" }}>AI accuracy</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust Bar ── */}
      <TrustBar />

      {/* ── Product Suite ── */}
      <ProductSuite />

      {/* ── Metrics ── */}
      <section className="py-10 md:py-14 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { value: "92%",    label: "Reduction in manual entry" },
              { value: "3 days", label: "Average approval cycle" },
              { value: "0.3%",   label: "Reconciliation error rate" },
              { value: "18×",    label: "Average ROI in 12 months" },
            ].map((m) => (
              <div key={m.label} className="text-center py-6 px-4 rounded-2xl border border-gray-100 anzu-card-hover">
                <div className="text-3xl font-bold mb-2" style={{ color: "#F97316" }}>{m.value}</div>
                <div className="text-sm text-gray-600">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="anzu-section" style={{ background: "#F8FAFC" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-14">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full mb-4" style={{ background: "#FFF7ED", color: "#F97316" }}>
              <Zap className="w-3 h-3" /> Complete AP automation platform
            </span>
            <h2 className="text-gray-900 mb-4" style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 600, letterSpacing: "-0.02em" }}>
              Everything you need to automate your accounts payable
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto" style={{ fontFamily: "var(--font-body)" }}>
              From invoice arrival to ERP posting, Anzu covers every step of the process without manual intervention.
            </p>
          </div>
          <div ref={featuresRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {FEATURE_META.map((meta, idx) => {
              const item = FEATURE_ITEMS[idx];
              const Icon = meta.icon;
              return (
                <div key={item.title} className="bg-white rounded-2xl p-6 border border-gray-100 anzu-card-hover group"
                  style={fadeUp(featuresVisible, idx * 70)}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: meta.bg }}>
                    <Icon className="w-5 h-5" style={{ color: meta.color }} />
                  </div>
                  <h3 className="text-gray-900 font-semibold mb-2 text-sm">{item.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
                  <Link href="/product/invoice-ingestion"
                    className="inline-flex items-center gap-1 mt-4 text-xs font-semibold transition-[gap] duration-150 hover:gap-2"
                    style={{ color: meta.color }}>
                    Explore <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="anzu-section bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-14">
            <h2 className="text-gray-900 mb-4" style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 600, letterSpacing: "-0.02em" }}>
              Invoice to ERP in three steps
            </h2>
            <p className="text-gray-600 max-w-xl mx-auto text-sm" style={{ fontFamily: "var(--font-body)" }}>
              Implementation in days, not months. No external consulting. No changes to your ERP.
            </p>
          </div>
          <div ref={stepsRef} className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-8 left-1/3 right-1/3 h-px" style={{ background: "linear-gradient(90deg, #F97316, #EA580C)" }} />
            {[
              { num: "01", title: "Connect your ERP or intake channel", desc: "In minutes, configure the integration with your ERP or activate email forwarding and the vendor portal." },
              { num: "02", title: "Anzu captures, extracts and validates", desc: "OCR + LLM extracts fields, validates business rules, taxes and vendor data automatically." },
              { num: "03", title: "Reconcile and approve in one click", desc: "Auto-match with PO and receipt. Exceptions are routed to the responsible party with full context to decide fast." },
            ].map((step, i) => (
              <div key={step.num} className="relative text-center group" style={fadeUp(stepsVisible, i * 100)}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 text-white font-bold text-lg shadow-lg transition-transform group-hover:scale-105"
                  style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}>
                  {step.num}
                </div>
                <h3 className="text-gray-900 font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link href="/demo"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white shadow-md anzu-btn-cta"
              style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}>
              See live demo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Industries ── */}
      <section className="anzu-section" style={{ background: "#F8FAFC" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-12">
            <h2 className="text-gray-900 mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 600, letterSpacing: "-0.02em" }}>
              Designed for your industry
            </h2>
            <p className="text-gray-600 text-sm max-w-lg mx-auto" style={{ fontFamily: "var(--font-body)" }}>
              Pre-configured workflows and rules for the specific challenges of construction, manufacturing and distribution.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {INDUSTRY_META.map((meta, idx) => {
              const item = INDUSTRY_ITEMS[idx];
              const Icon = meta.icon;
              return (
                <Link key={meta.href} href={meta.href} className="bg-white rounded-2xl p-5 border border-gray-100 anzu-card-hover group">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: meta.bg }}>
                    <Icon className="w-5 h-5" style={{ color: meta.color }} />
                  </div>
                  <h3 className="text-gray-900 font-semibold text-sm mb-1.5">{item.label}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
                  <div className="flex items-center gap-1 mt-3 text-xs font-semibold group-hover:gap-2 transition-[gap] duration-150" style={{ color: meta.color }}>
                    View solution <ArrowRight className="w-3 h-3" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="anzu-section bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-14">
            <h2 className="text-gray-900 mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 600, letterSpacing: "-0.02em" }}>
              Real results from real companies
            </h2>
          </div>
          <div ref={testimonialsRef} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {testimonials.map((t, idx) => (
              <div key={t.name} className="rounded-2xl p-6 border border-gray-100 anzu-card-hover" style={fadeUp(testimonialsVisible, idx * 80)}>
                <Quote className="w-6 h-6 mb-4" style={{ color: t.color }} />
                <p className="text-gray-700 text-sm leading-relaxed mb-5" style={{ fontFamily: "var(--font-body)", fontStyle: "italic" }}>
                  &ldquo;{t.text}&rdquo;
                </p>
                <div className="flex gap-4 mb-5 pt-4 border-t border-gray-100">
                  {t.metrics.map((m) => (
                    <div key={m.label}>
                      <div className="font-bold text-base" style={{ color: t.color }}>{m.value}</div>
                      <div className="text-xs text-gray-500">{m.label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: t.color }}>
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-500">{t.role} · {t.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="anzu-section" style={{ background: "#F8FAFC" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-12">
            <h2 className="text-gray-900 mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 600, letterSpacing: "-0.02em" }}>
              Simple plans, clear ROI
            </h2>
            <p className="text-gray-600 text-sm" style={{ fontFamily: "var(--font-body)" }}>
              30-day free trial on all plans. No credit card required.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {PLANS.map((plan, idx) => {
              const highlight = idx === 1;
              return (
                <div key={plan.name}
                  className={`rounded-2xl p-6 border transition-all ${highlight ? "border-orange-500 shadow-lg shadow-orange-100" : "border-gray-200 bg-white"}`}
                  style={highlight ? { background: "linear-gradient(135deg, #0C1B3A, #1E293B)" } : {}}>
                  {highlight && (
                    <span className="inline-flex text-xs font-bold px-2.5 py-1 rounded-full mb-3" style={{ background: "#F97316", color: "#fff" }}>
                      Most popular
                    </span>
                  )}
                  <h3 className={`font-bold mb-1 ${highlight ? "text-white" : "text-gray-900"}`}>{plan.name}</h3>
                  <div className="flex items-end gap-1 mb-1">
                    <span className={`text-2xl font-bold ${highlight ? "text-white" : "text-gray-900"}`}>{plan.price}</span>
                    {plan.currency && <span className={`text-xs mb-1 ${highlight ? "text-orange-200" : "text-gray-500"}`}>{plan.currency}</span>}
                  </div>
                  <p className={`text-xs mb-5 ${highlight ? "text-orange-200" : "text-gray-500"}`}>{plan.desc}</p>
                  <Link href="/demo"
                    className={`block text-center py-2.5 rounded-xl text-sm font-semibold mb-5 anzu-btn-cta ${highlight ? "bg-white text-orange-600" : "text-white"}`}
                    style={!highlight ? { background: "linear-gradient(135deg, #F97316, #EA580C)" } : {}}>
                    {plan.cta}
                  </Link>
                  <ul className="space-y-2">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${highlight ? "text-emerald-400" : "text-emerald-500"}`} />
                        <span className={`text-xs ${highlight ? "text-blue-100" : "text-gray-600"}`}>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <div className="text-center mt-8">
            <Link href="/pricing" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors">
              See full comparison <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="anzu-section bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 md:mb-12">
            <h2 className="text-gray-900 mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 600, letterSpacing: "-0.02em" }}>
              Frequently asked questions
            </h2>
          </div>
          <div>
            {FAQ_ITEMS.map((item) => (
              <FAQItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="anzu-section" style={{ background: "linear-gradient(135deg, #0C1B3A 0%, #1E293B 100%)" }}>
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="w-12 h-1 rounded-full mx-auto mb-8" style={{ background: "#F97316" }} />
          <h2 className="text-white mb-4" style={{ fontFamily: "var(--font-display)", fontSize: "var(--h2-size)", fontWeight: 600, letterSpacing: "-0.02em" }}>
            Start automating today
          </h2>
          <p className="text-gray-300 mb-8 max-w-lg mx-auto leading-relaxed" style={{ fontFamily: "var(--font-body)", fontSize: "1.05rem" }}>
            Join 120+ companies in Mexico and Colombia already processing millions in invoices without manual effort. Personalized demo in 30 minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/demo"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-sm font-bold text-white shadow-lg anzu-btn-cta"
              style={{ background: "linear-gradient(135deg, #F97316, #EA580C)", boxShadow: "0 8px 32px rgba(249,115,22,0.40)" }}>
              Request Demo <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/pricing"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-white border border-white/20 hover:bg-white/10 transition-colors">
              View Pricing
            </Link>
          </div>
          <p className="text-gray-500 text-xs mt-6">No credit card · Implementation in &lt;2 weeks · Spanish support</p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

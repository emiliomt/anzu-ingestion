"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  ChevronDown, Menu, X, FileText, GitMerge, CheckCircle2,
  Settings2, AlertTriangle, Plug2, Building2, Factory, Truck, Users,
  BookOpen, FileSearch, Briefcase, ArrowRight,
  LayoutDashboard, Upload, ShieldCheck,
} from "lucide-react";
import { AnzuLogo } from "./AnzuLogo";

/* ── Nav item arrays ── */
const PRODUCT_ICONS = [FileText, FileSearch, Settings2, GitMerge, CheckCircle2, AlertTriangle, Plug2];
const PRODUCT_ITEMS = [
  { label: "Invoice Capture",      desc: "Email, portal, WhatsApp",    href: "/product/invoice-ingestion" },
  { label: "OCR + AI Extraction",  desc: "High-precision fields",       href: "/product/extraction-ocr" },
  { label: "Validation Rules",     desc: "Policy engine",               href: "/product/validation-rules" },
  { label: "2/3-Way Matching",     desc: "Auto-match against PO",       href: "/product/matching" },
  { label: "Approval Workflows",   desc: "SLAs and escalations",        href: "/product/approvals" },
  { label: "Exception Management", desc: "Discrepancy resolution",      href: "/product/exceptions" },
  { label: "ERP/RPA Integrations", desc: "SAP, Oracle, Dynamics",       href: "/product/integrations" },
].map((item, i) => ({ ...item, icon: PRODUCT_ICONS[i] }));

const SOLUTION_ICONS = [Building2, Factory, Truck, Users];
const SOLUTION_ITEMS = [
  { label: "Construction",    href: "/solutions/construction" },
  { label: "Manufacturing",   href: "/solutions/manufacturing" },
  { label: "Distribution",    href: "/solutions/distribution" },
  { label: "Shared Services", href: "/solutions/shared-services" },
].map((item, i) => ({ ...item, icon: SOLUTION_ICONS[i] }));

const RESOURCE_ICONS = [BookOpen, Briefcase, FileSearch];
const RESOURCE_ITEMS = [
  { label: "Blog",             href: "/resources/blog" },
  { label: "Case Studies",     href: "/resources/case-studies" },
  { label: "Guides & Reports", href: "/resources/guides" },
].map((item, i) => ({ ...item, icon: RESOURCE_ICONS[i] }));

/* ── App launch items ── */
const APP_ICONS = [Upload, LayoutDashboard, ShieldCheck, GitMerge, BookOpen];
const APP_ITEMS = [
  { label: "Vendor Portal",     desc: "Submit invoices & track payment", href: "/portal",       color: "#2563EB" },
  { label: "Invoice Ingestor",  desc: "Review & extract invoices",       href: "/admin",        color: "#4F46E5" },
  { label: "Invoice Security",  desc: "Buyer & vendor verification",     href: "/security",     color: "#DC2626" },
  { label: "Invoice Matcher",   desc: "Match invoices to POs",           href: "/matcher",      color: "#10B981" },
  { label: "Pre-Accounting",    desc: "P&L and expense classification",  href: "/preaccounting",color: "#EA580C" },
].map((item, i) => ({ ...item, icon: APP_ICONS[i] }));

const ADMIN_APP_ITEMS = APP_ITEMS.slice(1, 5);   // admin-only apps (no portal)
const PORTAL_APP_ITEM = APP_ITEMS[0];             // vendor portal — shown separately

/* ── Desktop dropdown ── */
function DesktopDropdown({
  items,
}: {
  items: { label: string; href: string; icon: React.ElementType; desc?: string; color?: string }[];
}) {
  return (
    <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all duration-150 translate-y-1 group-hover:translate-y-0">
      {items.map((item) => {
        const Icon = item.icon;
        const accent = item.color ?? "#F97316";
        return (
          <Link key={item.href} href={item.href}
            className="flex items-start gap-3 px-4 py-2.5 hover:bg-orange-50 transition-colors group/item">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "#FFF7ED" }}>
              <Icon className="w-4 h-4" style={{ color: accent }} />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900 group-hover/item:text-orange-600 transition-colors">{item.label}</div>
              {item.desc && <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/* ── Mobile drawer section ── */
function DrawerSection({
  title,
  items,
  onClose,
}: {
  title: string;
  items: { label: string; href: string; icon: React.ElementType; desc?: string; color?: string }[];
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        className="w-full flex items-center justify-between px-2 py-3.5 text-sm font-semibold text-gray-800"
        onClick={() => setOpen(!open)}
      >
        {title}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="pb-2 space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const accent = item.color ?? "#F97316";
            return (
              <Link key={item.href} href={item.href} onClick={onClose}
                className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-orange-50 transition-colors">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#FFF7ED" }}>
                  <Icon className="w-4 h-4" style={{ color: accent }} />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-800">{item.label}</div>
                  {item.desc && <div className="text-xs text-gray-500">{item.desc}</div>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main header ── */
export function MarketingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const navLinkClass = (href: string) =>
    `text-sm font-medium transition-colors hover:text-orange-500 ${
      pathname === href ? "text-orange-500" : "text-gray-700"
    }`;

  return (
    <>
      {/* ── Sticky bar ── */}
      <header
        className="sticky top-0 z-40 backdrop-blur-md border-b border-gray-100"
        style={{
          background: scrolled ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.95)",
          boxShadow: scrolled ? "0 1px 20px rgba(0,0,0,0.07)" : "none",
          transition: "box-shadow 300ms ease-out, background 300ms ease-out",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="flex items-center justify-between"
            style={{ height: scrolled ? "60px" : "80px", transition: "height 300ms ease-out" }}
          >
            {/* Logo */}
            <Link href="/" className="flex items-center shrink-0">
              <AnzuLogo variant="full" scheme="light" size={scrolled ? 26 : 30} />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-6">
              <div className="relative group">
                <button className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-orange-500 transition-colors">
                  Product <ChevronDown className="w-3.5 h-3.5 mt-0.5" />
                </button>
                <DesktopDropdown items={PRODUCT_ITEMS} />
              </div>
              <div className="relative group">
                <button className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-orange-500 transition-colors">
                  Solutions <ChevronDown className="w-3.5 h-3.5 mt-0.5" />
                </button>
                <DesktopDropdown items={SOLUTION_ITEMS} />
              </div>
              <Link href="/integrations" className={navLinkClass("/integrations")}>Integrations</Link>
              <div className="relative group">
                <button className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-orange-500 transition-colors">
                  Resources <ChevronDown className="w-3.5 h-3.5 mt-0.5" />
                </button>
                <DesktopDropdown items={RESOURCE_ITEMS} />
              </div>
              <Link href="/pricing" className={navLinkClass("/pricing")}>Pricing</Link>
            </nav>

            {/* Desktop right: sign in + Launch App dropdown */}
            <div className="hidden lg:flex items-center gap-3">
              <Link href="/portal" className="text-sm font-medium text-gray-700 hover:text-orange-500 transition-colors">
                Sign in
              </Link>
              {/* Launch App — hover dropdown */}
              <div className="relative group">
                <button
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white anzu-btn-cta"
                  style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
                >
                  Launch App <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <div className="absolute top-full right-0 mt-1 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 opacity-0 group-hover:opacity-100 invisible group-hover:visible transition-all duration-150 translate-y-1 group-hover:translate-y-0">
                  {/* Admin apps group */}
                  <div className="px-4 pt-1.5 pb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Admin Apps</span>
                  </div>
                  {ADMIN_APP_ITEMS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.href} href={item.href}
                        className="flex items-start gap-3 px-4 py-2.5 hover:bg-orange-50 transition-colors group/item">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "#FFF7ED" }}>
                          <Icon className="w-4 h-4" style={{ color: item.color }} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 group-hover/item:text-orange-600 transition-colors">{item.label}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                        </div>
                      </Link>
                    );
                  })}
                  {/* Vendor portal */}
                  <div className="mx-4 my-1.5 border-t border-gray-100" />
                  {(() => {
                    const item = PORTAL_APP_ITEM;
                    const Icon = item.icon;
                    return (
                      <Link href={item.href}
                        className="flex items-start gap-3 px-4 py-2.5 hover:bg-blue-50 transition-colors group/item">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "#EFF6FF" }}>
                          <Icon className="w-4 h-4" style={{ color: item.color }} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 group-hover/item:text-blue-600 transition-colors">{item.label}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                        </div>
                      </Link>
                    );
                  })()}
                  <div className="mx-4 mt-2 pt-2 border-t border-gray-100">
                    <Link href="/#products"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white anzu-btn-cta"
                      style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}>
                      Explore All Products <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile hamburger */}
            <div className="flex lg:hidden items-center gap-2">
              <button
                className="p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="absolute inset-0 anzu-drawer-backdrop"
            style={{ background: "rgba(12,27,58,0.55)", backdropFilter: "blur(4px)" }}
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex flex-col w-[85vw] max-w-sm h-full bg-white anzu-drawer-open" style={{ willChange: "transform" }}>
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 shrink-0 border-b border-gray-100" style={{ height: "64px" }}>
              <AnzuLogo variant="full" scheme="light" size={28} />
              <button onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable nav */}
            <div className="flex-1 overflow-y-auto px-4 py-2">
              {/* Launch App — top section, prominent */}
              <DrawerSection title="Launch App" items={APP_ITEMS} onClose={() => setMobileOpen(false)} />
              <DrawerSection title="Product"   items={PRODUCT_ITEMS}  onClose={() => setMobileOpen(false)} />
              <DrawerSection title="Solutions" items={SOLUTION_ITEMS} onClose={() => setMobileOpen(false)} />
              <DrawerSection title="Resources" items={RESOURCE_ITEMS} onClose={() => setMobileOpen(false)} />

              {/* Direct links */}
              <div className="py-3 space-y-0.5">
                {[
                  { label: "Integrations", href: "/integrations" },
                  { label: "Pricing",      href: "/pricing" },
                ].map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                    className="block px-2 py-3 text-sm font-semibold text-gray-800 hover:text-orange-500 transition-colors">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Sticky CTA */}
            <div className="shrink-0 px-4 pb-8 pt-4 border-t border-gray-100 space-y-3"
              style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>
              <Link
                href="/#products"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold text-white anzu-btn-cta"
                style={{ background: "linear-gradient(135deg, #F97316, #EA580C)", boxShadow: "0 8px 24px rgba(249,115,22,0.35)" }}
              >
                Explore All Products <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/portal"
                onClick={() => setMobileOpen(false)}
                className="block w-full py-3 text-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Already have an account · Sign in
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

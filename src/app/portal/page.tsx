"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import {
  Globe, Mail, MessageCircle, Shield, Zap, Search,
  Upload, CheckCircle2, Menu, X, ArrowRight, FileText,
  LayoutDashboard, LogIn, UserPlus,
} from "lucide-react";
import { AnzuLogo } from "@/components/landing/AnzuLogo";
import { UploadZone } from "@/components/UploadZone";
import { StatusTracker } from "@/app/StatusTracker";

/* ─── Portal Header ──────────────────────────────────────────────────────────── */
function PortalHeader() {
  const [scrolled, setScrolled]     = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { isLoaded, isSignedIn, user } = useUser();

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

  return (
    <>
      <header
        className="sticky top-0 z-40 backdrop-blur-md border-b border-gray-100"
        style={{
          background: scrolled ? "rgba(255,255,255,0.98)" : "rgba(255,255,255,0.95)",
          boxShadow: scrolled ? "0 1px 20px rgba(0,0,0,0.07)" : "none",
          transition: "box-shadow 300ms ease-out, background 300ms ease-out",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="flex items-center justify-between"
            style={{ height: scrolled ? "60px" : "80px", transition: "height 300ms ease-out" }}
          >
            <Link href="/" className="flex items-center shrink-0">
              <AnzuLogo variant="full" scheme="light" size={scrolled ? 26 : 30}
                style={{ transition: "height 300ms ease-out" }} />
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              <Link href="/portal" className="text-sm font-medium text-gray-700 hover:text-orange-500 transition-colors">
                Submit Invoice
              </Link>
              <Link href="/status/lookup" className="text-sm font-medium text-gray-700 hover:text-orange-500 transition-colors">
                Track Invoice
              </Link>
              {isLoaded && isSignedIn && (
                <Link href="/portal/dashboard" className="text-sm font-medium text-gray-700 hover:text-orange-500 transition-colors">
                  My Invoices
                </Link>
              )}
              <Link href="/" className="text-sm font-medium text-gray-700 hover:text-orange-500 transition-colors">
                Back to Site
              </Link>
            </nav>

            <div className="hidden md:flex items-center gap-3">
              {isLoaded && isSignedIn ? (
                <>
                  <Link
                    href="/portal/dashboard"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    My Invoices
                  </Link>
                  <UserButton afterSignOutUrl="/portal" />
                </>
              ) : (
                <>
                  <SignInButton mode="redirect" forceRedirectUrl="/portal/dashboard">
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors">
                      <LogIn className="w-4 h-4" />
                      Sign In
                    </button>
                  </SignInButton>
                  <SignUpButton mode="redirect" forceRedirectUrl="/portal/dashboard">
                    <button
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                      style={{ background: "linear-gradient(135deg, #F97316, #EA580C)", boxShadow: "0 4px 16px rgba(249,115,22,0.35)" }}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Create Account
                    </button>
                  </SignUpButton>
                </>
              )}
            </div>

            <button
              className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer ─────────────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(12,27,58,0.55)", backdropFilter: "blur(4px)" }}
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex flex-col w-[85vw] max-w-sm h-full bg-white" style={{ willChange: "transform" }}>
            <div className="flex items-center justify-between px-4 shrink-0 border-b border-gray-100" style={{ height: "64px" }}>
              <AnzuLogo variant="full" scheme="light" size={28} />
              <button onClick={() => setMobileOpen(false)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
              {[
                { label: "Submit Invoice",  icon: Upload,          href: "/portal",        bg: "#FFF7ED", color: "#F97316" },
                { label: "Track Invoice",   icon: Search,          href: "/status/lookup", bg: "#F0FDF4", color: "#10B981" },
                ...(isSignedIn ? [{ label: "My Invoices", icon: LayoutDashboard, href: "/portal/dashboard", bg: "#EEF2FF", color: "#4F46E5" }] : []),
                { label: "Back to Site",    icon: Globe,           href: "/",              bg: "#F8FAFC", color: "#64748B" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-orange-50 transition-colors">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: item.bg }}>
                      <Icon className="w-4 h-4" style={{ color: item.color }} />
                    </div>
                    <span className="text-sm font-medium text-gray-800">{item.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="shrink-0 px-4 pt-4 space-y-2 border-t border-gray-100"
              style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>
              {isLoaded && !isSignedIn && (
                <>
                  <SignInButton mode="redirect" forceRedirectUrl="/portal/dashboard">
                    <button className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200">
                      <LogIn className="w-4 h-4" /> Sign In
                    </button>
                  </SignInButton>
                  <SignUpButton mode="redirect" forceRedirectUrl="/portal/dashboard">
                    <button className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold text-white"
                      style={{ background: "linear-gradient(135deg, #F97316, #EA580C)", boxShadow: "0 8px 24px rgba(249,115,22,0.35)" }}>
                      <UserPlus className="w-4 h-4" /> Create Account
                    </button>
                  </SignUpButton>
                </>
              )}
              {isLoaded && isSignedIn && (
                <Link href="/portal/dashboard" onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}>
                  <LayoutDashboard className="w-4 h-4" /> My Invoices
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────────── */
export default function ProviderPortal() {
  const { isLoaded, isSignedIn, user } = useUser();

  return (
    <div className="min-h-screen" style={{ background: "#F8FAFC" }}>
      <PortalHeader />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0C1B3A 0%, #1E293B 60%, #0C1B3A 100%)", padding: "72px 0 48px" }}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #F97316, transparent)" }} />
          <div className="absolute -bottom-20 left-10 w-64 h-64 rounded-full"
            style={{ background: "radial-gradient(circle, #10B981, transparent)", opacity: 0.06 }} />
        </div>

        <div className="relative max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6 border anzu-fade-up"
            style={{ background: "rgba(249,115,22,0.15)", borderColor: "rgba(249,115,22,0.35)", color: "#FED7AA", animationDelay: "0ms" }}
          >
            <Zap className="w-3 h-3" />
            AI Extraction · 98%+ accuracy
          </div>

          <h1
            className="text-white mb-4 anzu-fade-up"
            style={{ fontFamily: "var(--font-display)", fontSize: "var(--h1-size)", fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.02em", animationDelay: "80ms" }}
          >
            Submit your invoice,<br />
            <span style={{ background: "linear-gradient(135deg, #FB923C, #F97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              we handle the rest
            </span>
          </h1>

          <p className="text-gray-300 mb-8 anzu-fade-up"
            style={{ fontFamily: "var(--font-body)", fontSize: "1.1rem", lineHeight: 1.65, animationDelay: "180ms" }}>
            Upload via web, email or WhatsApp. Our AI extracts all data automatically — no manual entry, no delays.
          </p>

          {/* CTA for non-signed-in users */}
          {isLoaded && !isSignedIn && (
            <div className="flex items-center justify-center gap-3 mb-8 anzu-fade-up" style={{ animationDelay: "260ms" }}>
              <SignUpButton mode="redirect" forceRedirectUrl="/portal/dashboard">
                <button
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #F97316, #EA580C)", boxShadow: "0 4px 20px rgba(249,115,22,0.4)" }}
                >
                  <UserPlus className="w-4 h-4" />
                  Create Provider Account
                </button>
              </SignUpButton>
              <SignInButton mode="redirect" forceRedirectUrl="/portal/dashboard">
                <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white border border-white/20 hover:bg-white/10 transition-colors">
                  <LogIn className="w-4 h-4" />
                  Sign In
                </button>
              </SignInButton>
            </div>
          )}

          {/* Signed-in greeting */}
          {isLoaded && isSignedIn && (
            <div className="mb-8 anzu-fade-up" style={{ animationDelay: "260ms" }}>
              <Link href="/portal/dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: "linear-gradient(135deg, #F97316, #EA580C)", boxShadow: "0 4px 20px rgba(249,115,22,0.4)" }}
              >
                <LayoutDashboard className="w-4 h-4" />
                View My Invoices
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          <div className="flex items-center justify-center gap-3 flex-wrap anzu-fade-up" style={{ animationDelay: "320ms" }}>
            {[
              { icon: Globe,         label: "Web Upload", bg: "rgba(249,115,22,0.15)", color: "#FDBA74" },
              { icon: Mail,          label: "Email",       bg: "rgba(16,185,129,0.15)",  color: "#6EE7B7" },
              { icon: MessageCircle, label: "WhatsApp",    bg: "rgba(37,99,235,0.15)",   color: "#93C5FD" },
            ].map((ch) => {
              const Icon = ch.icon;
              return (
                <div key={ch.label}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border"
                  style={{ background: ch.bg, borderColor: "rgba(255,255,255,0.1)", color: ch.color }}>
                  <Icon className="w-3.5 h-3.5" />{ch.label}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Upload + Side Info ────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 mt-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">

          {/* Upload card */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 p-6"
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4" style={{ color: "#F97316" }} />
              <h2 className="text-sm font-semibold text-gray-900" style={{ fontFamily: "var(--font-display)" }}>
                Upload Invoice
              </h2>
            </div>
            {isLoaded && isSignedIn && user?.primaryEmailAddress?.emailAddress && (
              <p className="text-xs text-emerald-600 mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Submitting as <strong className="ml-1">{user.primaryEmailAddress.emailAddress}</strong>
              </p>
            )}
            <p className="text-xs text-gray-500 mb-5">Drag your file or click to browse</p>
            <UploadZone prefilledEmail={isSignedIn ? (user?.primaryEmailAddress?.emailAddress ?? "") : ""} />
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-4">
            {[
              { icon: Mail,          color: "#F97316", bg: "#FFF7ED", title: "Email Submission", desc: "Send your PDF or image invoice to:", code: "invoices@anzu.mx" },
              { icon: MessageCircle, color: "#10B981", bg: "#ECFDF5", title: "WhatsApp",          desc: "Send your invoice image or PDF to:", code: "+1 (415) 523-8886" },
            ].map((ch) => {
              const Icon = ch.icon;
              return (
                <div key={ch.title} className="bg-white rounded-2xl border border-gray-100 p-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: ch.bg }}>
                      <Icon className="w-4 h-4" style={{ color: ch.color }} />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-800">{ch.title}</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{ch.desc}</p>
                  <code className="block text-xs px-2.5 py-1.5 rounded-lg border font-mono"
                    style={{ background: "#F8FAFC", borderColor: "#E2E8F0", color: "#0C1B3A" }}>{ch.code}</code>
                </div>
              );
            })}

            {/* Trust signals */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
              <div className="flex flex-col gap-2.5">
                {[
                  { icon: Shield,       color: "#10B981", label: "Encrypted storage" },
                  { icon: Zap,          color: "#F97316", label: "< 2 min processing" },
                  { icon: CheckCircle2, color: "#2563EB", label: "7-year retention"  },
                ].map((t) => {
                  const Icon = t.icon;
                  return (
                    <div key={t.label} className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${t.color}15` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: t.color }} />
                      </div>
                      <span className="text-xs text-gray-600">{t.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Status Tracker ──────────────────────────────────────────────────── */}
        <div className="mt-6 bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center gap-2 mb-1">
            <Search className="w-4 h-4" style={{ color: "#F97316" }} />
            <h3 className="text-sm font-semibold text-gray-800" style={{ fontFamily: "var(--font-display)" }}>
              Track your invoice
            </h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">Enter your reference number or UUID to see real-time status.</p>
          <StatusTracker />
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-white py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <AnzuLogo variant="full" scheme="light" size={24} />
          <p className="text-xs text-gray-400 text-center">© 2025 Anzu Dynamics · Accounts Payable Automation Platform</p>
          <Link href="/" className="text-xs text-orange-500 hover:text-orange-600 font-medium transition-colors">← Main site</Link>
        </div>
      </footer>
    </div>
  );
}

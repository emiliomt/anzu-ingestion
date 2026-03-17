"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight, Clock, Users, Zap, Star } from "lucide-react";
import { AnnouncementBar } from "@/components/landing/AnnouncementBar";
import { MarketingHeader } from "@/components/landing/MarketingHeader";
import { MarketingFooter } from "@/components/landing/MarketingFooter";

const erpOptions = [
  "SAP S/4HANA", "SAP ECC", "Oracle ERP Cloud", "Oracle E-Business Suite",
  "Microsoft Dynamics 365", "NetSuite", "Other ERP (via RPA)", "No ERP yet",
];
const volumeOptions = [
  "Less than 100/mo", "100–500/mo", "500–2,000/mo", "2,000–10,000/mo", "More than 10,000/mo",
];
const roleOptions = [
  "CFO / Finance Director", "Controller", "AP Manager", "Operations Director",
  "IT / ERP Admin", "Shared Services", "Other",
];
const countryOptions = ["Mexico", "Colombia", "Other"];

export default function DemoPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "", company: "", email: "", phone: "",
    country: "", role: "", erp: "", volume: "", message: "",
  });

  const updateForm = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div>
        <AnnouncementBar />
        <MarketingHeader />
        <div className="min-h-[70vh] flex items-center justify-center px-4" style={{ background: "#F8FAFC" }}>
          <div className="max-w-lg w-full text-center py-20">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: "#D1FAE5" }}>
              <CheckCircle2 className="w-8 h-8" style={{ color: "#059669" }} />
            </div>
            <h2 className="text-gray-900 mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: 700 }}>
              Request received!
            </h2>
            <p className="text-gray-600 text-sm mb-6 leading-relaxed">
              Our sales team will contact you within 4 business hours to schedule your personalized demo.
              Get ready to see Anzu in action with your own data.
            </p>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 text-left space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">What&apos;s next?</h4>
              {[
                { step: "1", text: "You'll receive a confirmation email in the next few minutes" },
                { step: "2", text: "Our CSM will reach out to understand your current process" },
                { step: "3", text: "30-min live demo with cases from your industry" },
                { step: "4", text: "Personalized proposal and implementation plan" },
              ].map((s) => (
                <div key={s.step} className="flex items-start gap-3">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
                    style={{ background: "#F97316" }}
                  >
                    {s.step}
                  </div>
                  <span className="text-sm text-gray-600">{s.text}</span>
                </div>
              ))}
            </div>
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium transition-colors" style={{ color: "#F97316" }}>
              ← Back to home
            </Link>
          </div>
        </div>
        <MarketingFooter />
      </div>
    );
  }

  return (
    <div>
      <AnnouncementBar />
      <MarketingHeader />

      <div style={{ background: "#F8FAFC" }} className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-start">

            {/* ── Left: Info panel ── */}
            <div className="lg:sticky lg:top-24">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full mb-5"
                style={{ background: "#FFF7ED", color: "#F97316" }}
              >
                <Zap className="w-3 h-3" /> Free demo · 30 minutes
              </span>

              <h1
                className="text-gray-900 mb-4"
                style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 700, lineHeight: 1.2 }}
              >
                See Anzu in action<br />with your own data
              </h1>
              <p className="text-gray-600 text-sm leading-relaxed mb-8 max-w-md" style={{ fontFamily: "var(--font-body)" }}>
                In 30 minutes we show you how Anzu can transform your accounts payable process.
                A personalized demo for your ERP and industry.
              </p>

              {/* Benefits */}
              <div className="space-y-4 mb-8">
                {[
                  { icon: Clock, title: "Implementation in <2 weeks", desc: "No consulting fees, no disruption to your current ERP." },
                  { icon: Zap,   title: "ROI in the first quarter",   desc: "Average 18× ROI based on 120+ implementations." },
                  { icon: Users, title: "Spanish support 24/7",        desc: "Team in CDMX and Bogotá, always available." },
                ].map((b) => {
                  const Icon = b.icon;
                  return (
                    <div key={b.title} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#FFF7ED" }}>
                        <Icon className="w-4 h-4" style={{ color: "#F97316" }} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{b.title}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{b.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Testimonial snippet */}
              <div className="rounded-xl p-4 border border-gray-200 bg-white">
                <div className="flex items-center gap-1 mb-2">
                  {[1,2,3,4,5].map((i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-xs text-gray-700 leading-relaxed italic mb-3">
                  &ldquo;From the demo to go-live was exactly 11 business days. Our Oracle EBS integration went without a hitch.&rdquo;
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: "#F97316" }}>
                    JV
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-800">Jorge Vargas</div>
                    <div className="text-xs text-gray-500">CFO · Grupo Constructor Andino</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right: Form ── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">
              <h2 className="text-gray-900 font-bold mb-1 text-base">Request a Personalized Demo</h2>
              <p className="text-gray-500 text-xs mb-6">All fields are required</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Full name</label>
                    <input
                      required
                      type="text"
                      value={form.name}
                      onChange={(e) => updateForm("name", e.target.value)}
                      placeholder="María González"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-orange-400 transition-all"
                      style={{ "--tw-ring-color": "rgba(249,115,22,0.3)" } as React.CSSProperties}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Company</label>
                    <input
                      required
                      type="text"
                      value={form.company}
                      onChange={(e) => updateForm("company", e.target.value)}
                      placeholder="Grupo Regiomontano SA"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-orange-400 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Corporate email</label>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) => updateForm("email", e.target.value)}
                      placeholder="maria@empresa.com"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-orange-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Phone / WhatsApp</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => updateForm("phone", e.target.value)}
                      placeholder="+52 81 1234 5678"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-orange-400 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Country</label>
                    <select
                      required
                      value={form.country}
                      onChange={(e) => updateForm("country", e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:border-orange-400 transition-all"
                    >
                      <option value="">Select...</option>
                      {countryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Your role</label>
                    <select
                      required
                      value={form.role}
                      onChange={(e) => updateForm("role", e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:border-orange-400 transition-all"
                    >
                      <option value="">Select...</option>
                      {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Current ERP</label>
                  <select
                    required
                    value={form.erp}
                    onChange={(e) => updateForm("erp", e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:border-orange-400 transition-all"
                  >
                    <option value="">Select ERP...</option>
                    {erpOptions.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Invoice volume per month</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {volumeOptions.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => updateForm("volume", v)}
                        className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${
                          form.volume === v
                            ? "border-orange-500 text-orange-700"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                        style={form.volume === v ? { background: "#FFF7ED" } : {}}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Anything specific you want to see? <span className="text-gray-400">(optional)</span>
                  </label>
                  <textarea
                    rows={3}
                    value={form.message}
                    onChange={(e) => updateForm("message", e.target.value)}
                    placeholder="E.g.: SAP ECC integration, CFDI 4.0 handling, multi-level approval flows..."
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:border-orange-400 transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white shadow-md anzu-btn-cta"
                  style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
                >
                  Request my Demo <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <p className="text-xs text-gray-400 text-center mt-4">
                By submitting, you agree to our{" "}
                <Link href="/privacy" className="hover:underline" style={{ color: "#F97316" }}>Privacy Policy</Link>.
                We never share your data with third parties.
              </p>
            </div>
          </div>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
}

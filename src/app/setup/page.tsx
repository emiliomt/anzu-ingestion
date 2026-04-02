"use client";

/**
 * /setup — User onboarding page
 * ─────────────────────────────────────────────────────────────────────────────
 * Shown to users who have authenticated via Clerk but haven't been assigned
 * a role yet. CLIENTs create their own Organization here — no admin
 * pre-provisioning required. PROVIDERs register without an org.
 *
 * POST body for CLIENT: { role, orgName, country, plan }
 * POST body for PROVIDER: { role: "PROVIDER" }
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Building2, Truck, ArrowRight, Shield, ChevronDown } from "lucide-react";
import { AnzuLogo } from "@/components/landing/AnzuLogo";

const COUNTRIES = [
  { code: "CO", label: "Colombia" },
  { code: "MX", label: "Mexico" },
  { code: "PE", label: "Peru" },
  { code: "CL", label: "Chile" },
  { code: "AR", label: "Argentina" },
  { code: "EC", label: "Ecuador" },
  { code: "US", label: "United States" },
];

const PLANS = [
  { value: "Starter",    label: "Starter",    price: "$990/mo",  desc: "Invoice ingestion + portal" },
  { value: "Growth",     label: "Growth",     price: "$2,490/mo", desc: "+ Matching, ERP export, caja chica" },
  { value: "Enterprise", label: "Enterprise", price: "Custom",   desc: "+ SAP, Contpaqi, dedicated support" },
] as const;

type Plan = "Starter" | "Growth" | "Enterprise";

export default function SetupPage() {
  const router = useRouter();
  const { user } = useUser();

  const [selectedRole, setSelectedRole] = useState<"CLIENT" | "PROVIDER" | null>(null);
  const [orgName, setOrgName] = useState("");
  const [country, setCountry]   = useState("CO");
  const [plan, setPlan]         = useState<Plan>("Growth");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!selectedRole) return;
    setIsLoading(true);
    setError(null);

    try {
      const body: Record<string, string> =
        selectedRole === "CLIENT"
          ? { role: selectedRole, orgName: orgName.trim(), country, plan }
          : { role: selectedRole };

      if (selectedRole === "CLIENT" && !orgName.trim()) {
        setError("Please enter your company name.");
        setIsLoading(false);
        return;
      }

      const res = await fetch("/api/auth/setup-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json() as { error?: string; profile?: { role: string } };

      if (!res.ok) {
        setError(data.error ?? "Setup failed. Please try again.");
        return;
      }

      await user?.reload();
      router.push(selectedRole === "CLIENT" ? "/client" : "/provider");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: "linear-gradient(135deg, #0C1B3A 0%, #1E293B 100%)" }}
    >
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-8">
          <AnzuLogo variant="full" scheme="dark" size={36} />
        </div>

        <div className="bg-white rounded-2xl p-8" style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
          <h1
            className="text-2xl font-bold text-gray-900 mb-2 text-center"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Welcome to Anzu
          </h1>
          <p className="text-sm text-gray-500 text-center mb-8">
            Tell us how you&apos;ll use the platform to set up your account.
          </p>

          {/* Role selection */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => setSelectedRole("CLIENT")}
              className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all text-left ${
                selectedRole === "CLIENT"
                  ? "border-orange-500 bg-orange-50"
                  : "border-gray-200 hover:border-orange-300 hover:bg-orange-50/50"
              }`}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: selectedRole === "CLIENT" ? "#FFF7ED" : "#F8FAFC" }}
              >
                <Building2 className="w-6 h-6" style={{ color: "#F97316" }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Company User</p>
                <p className="text-xs text-gray-500 mt-0.5">Manage invoices, projects &amp; ERP</p>
              </div>
            </button>

            <button
              onClick={() => setSelectedRole("PROVIDER")}
              className={`flex flex-col items-center gap-3 p-5 rounded-xl border-2 transition-all text-left ${
                selectedRole === "PROVIDER"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/50"
              }`}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: selectedRole === "PROVIDER" ? "#EFF6FF" : "#F8FAFC" }}
              >
                <Truck className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Supplier / Vendor</p>
                <p className="text-xs text-gray-500 mt-0.5">Submit invoices to clients</p>
              </div>
            </button>
          </div>

          {/* CLIENT: org creation form */}
          {selectedRole === "CLIENT" && (
            <div className="space-y-4 mb-6">
              {/* Company name */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Constructora Bogotá S.A.S."
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                />
              </div>

              {/* Country */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Country</label>
                <div className="relative">
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full appearance-none px-3 py-2.5 pr-8 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Plan */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Plan</label>
                <div className="space-y-2">
                  {PLANS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPlan(p.value)}
                      className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl border-2 text-sm transition-all ${
                        plan === p.value
                          ? "border-orange-500 bg-orange-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="text-left">
                        <span className="font-semibold text-gray-900">{p.label}</span>
                        <span className="ml-2 text-xs text-gray-500">{p.desc}</span>
                      </div>
                      <span
                        className="font-semibold shrink-0"
                        style={{ color: plan === p.value ? "#F97316" : "#6B7280" }}
                      >
                        {p.price}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  You can change plans anytime from your billing page.
                </p>
              </div>
            </div>
          )}

          {/* PROVIDER: info message */}
          {selectedRole === "PROVIDER" && (
            <div
              className="mb-6 flex items-start gap-2.5 p-3.5 rounded-xl text-sm"
              style={{ background: "#EFF6FF", color: "#1D4ED8" }}
            >
              <Shield className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                As a supplier, you&apos;ll be able to submit invoices after a company invites you to
                connect. You&apos;ll see their name in your upload form once accepted.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!selectedRole || isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{
              background: selectedRole ? "linear-gradient(135deg, #F97316, #EA580C)" : "#CBD5E1",
              boxShadow: selectedRole ? "0 4px 16px rgba(249,115,22,0.35)" : "none",
            }}
          >
            {isLoading ? "Setting up..." : "Continue"}
            {!isLoading && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Need help? Contact{" "}
          <a href="mailto:support@anzu.io" className="text-orange-400 hover:text-orange-300">
            support@anzu.io
          </a>
        </p>
      </div>
    </div>
  );
}

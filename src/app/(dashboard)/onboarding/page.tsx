// Anzu Dynamics — Onboarding Wizard
// 3-step flow for new organizations:
//   Step 1: Create or confirm your organization (company name, country, ERP)
//   Step 2: Configure regional defaults (currency, language, VAT regime)
//   Step 3: Quick-start — upload a test invoice and run the pipeline
//
// Clerk Organizations must be enabled in the Clerk dashboard.
// This page uses Clerk's <CreateOrganization /> component for step 1.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization, useOrganizationList, CreateOrganization } from "@clerk/nextjs";
import type { SetActive } from "@clerk/types";
import { Building2, Globe, Zap, CheckCircle2, ArrowRight, ChevronRight } from "lucide-react";

const ERP_OPTIONS = [
  { value: "sinco",   label: "SINCO",          flag: "🇨🇴", market: "Colombia" },
  { value: "siigo",   label: "Siigo",           flag: "🇨🇴", market: "Colombia" },
  { value: "sap_b1",  label: "SAP Business One", flag: "🌎", market: "LATAM" },
  { value: "contpaq", label: "CONTPAQi",        flag: "🇲🇽", market: "México" },
  { value: "other",   label: "Otro / API",      flag: "⚙️",  market: "Custom" },
] as const;

const COUNTRY_OPTIONS = [
  { value: "MX", label: "México",   currency: "MXN", flag: "🇲🇽" },
  { value: "CO", label: "Colombia", currency: "COP", flag: "🇨🇴" },
] as const;

// ── Step indicators ────────────────────────────────────────────────────────────

function StepIndicator({ step, current }: { step: number; current: number }) {
  const done = step < current;
  const active = step === current;
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
          done
            ? "bg-green-500 text-white"
            : active
            ? "text-white"
            : "bg-gray-100 text-gray-400"
        }`}
        style={active ? { background: "linear-gradient(135deg, #F97316, #EA580C)" } : {}}
      >
        {done ? <CheckCircle2 className="w-4 h-4" /> : step}
      </div>
      <span
        className={`text-sm font-medium hidden sm:block ${
          active ? "text-gray-900" : done ? "text-green-600" : "text-gray-400"
        }`}
      >
        {step === 1 ? "Organización" : step === 2 ? "Configuración" : "Prueba rápida"}
      </span>
    </div>
  );
}

// ── Step 2: Regional & ERP configuration ──────────────────────────────────────

function StepConfigure({ onNext }: { onNext: (data: { country: string; erp: string }) => void }) {
  const [country, setCountry] = useState<string>("CO");
  const [erp, setErp] = useState<string>("");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Configuración regional</h2>
        <p className="text-sm text-gray-500">
          Esto configura las monedas, regímenes fiscales y formatos de número correctos para tu país.
        </p>
      </div>

      {/* Country selector */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
          País principal
        </label>
        <div className="grid grid-cols-2 gap-3">
          {COUNTRY_OPTIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCountry(c.value)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                country === c.value
                  ? "border-orange-500 bg-orange-50"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <span className="text-2xl">{c.flag}</span>
              <div>
                <div className="text-sm font-semibold text-gray-900">{c.label}</div>
                <div className="text-xs text-gray-500">{c.currency}</div>
              </div>
              {country === c.value && (
                <CheckCircle2 className="w-4 h-4 text-orange-500 ml-auto" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ERP selector */}
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
          ERP actual <span className="text-gray-400 font-normal normal-case">(opcional)</span>
        </label>
        <div className="grid grid-cols-1 gap-2">
          {ERP_OPTIONS.map((e) => (
            <button
              key={e.value}
              type="button"
              onClick={() => setErp(erp === e.value ? "" : e.value)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all ${
                erp === e.value
                  ? "border-orange-500 bg-orange-50 text-orange-900"
                  : "border-gray-200 hover:border-gray-300 text-gray-700"
              }`}
            >
              <span className="text-base">{e.flag}</span>
              <span className="text-sm font-medium">{e.label}</span>
              <span className="text-xs text-gray-400 ml-auto">{e.market}</span>
              {erp === e.value && <CheckCircle2 className="w-4 h-4 text-orange-500" />}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => onNext({ country, erp })}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white"
        style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
      >
        Continuar <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Step 3: Quick-start ────────────────────────────────────────────────────────

function StepQuickStart({ onFinish }: { onFinish: () => void }) {
  const [choice, setChoice] = useState<"demo" | "upload" | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">¡Listo para empezar!</h2>
        <p className="text-sm text-gray-500">
          ¿Cómo quieres comenzar tu primera experiencia con Anzu?
        </p>
      </div>

      <div className="grid gap-3">
        {/* Demo mode */}
        <button
          type="button"
          onClick={() => setChoice("demo")}
          className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all ${
            choice === "demo"
              ? "border-orange-500 bg-orange-50"
              : "border-gray-200 hover:border-gray-300 bg-white"
          }`}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "#FFF7ED" }}
          >
            <Zap className="w-5 h-5" style={{ color: "#F97316" }} />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900 mb-0.5">
              Modo demo — ver todo en acción
            </div>
            <div className="text-xs text-gray-500">
              Cargamos 8 facturas de ejemplo (5 mexicanas CFDI + 3 colombianas) y ejecutamos
              el pipeline completo. Cero configuración.
            </div>
          </div>
          {choice === "demo" && (
            <CheckCircle2 className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
          )}
        </button>

        {/* Upload own invoice */}
        <button
          type="button"
          onClick={() => setChoice("upload")}
          className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all ${
            choice === "upload"
              ? "border-orange-500 bg-orange-50"
              : "border-gray-200 hover:border-gray-300 bg-white"
          }`}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "#F0FDF4" }}
          >
            <Globe className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900 mb-0.5">
              Subir mi propia factura
            </div>
            <div className="text-xs text-gray-500">
              PDF, imagen o XML. Anzu extrae, valida y categoriza en segundos.
              Ideal para probar con datos reales de tu empresa.
            </div>
          </div>
          {choice === "upload" && (
            <CheckCircle2 className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
          )}
        </button>
      </div>

      <button
        onClick={onFinish}
        disabled={!choice}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed"
        style={choice ? { background: "linear-gradient(135deg, #F97316, #EA580C)" } : { background: "#D1D5DB" }}
        data-choice={choice}
      >
        {choice === "demo" ? "Iniciar Demo →" : choice === "upload" ? "Ir al Dashboard →" : "Selecciona una opción"}
      </button>
    </div>
  );
}

// ── Main onboarding page ───────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { organization } = useOrganization();
  const { userMemberships, isLoaded, setActive } = useOrganizationList({ userMemberships: true });
  const [step, setStep] = useState<1 | 2 | 3>(organization ? 2 : 1);
  const [config, setConfig] = useState<{ country: string; erp: string } | null>(null);
  const [activating, setActivating] = useState(false);

  // If user already has an active org, skip step 1
  const effectiveStep = organization && step === 1 ? 2 : step;
  const memberships = userMemberships?.data ?? [];

  const handleOrgCreated = () => setStep(2);

  // Activate an existing org and proceed to step 2
  const handleActivateExisting = async (orgId: string) => {
    setActivating(true);
    try {
      await (setActive as SetActive)({ organization: orgId });
      // Hard navigation to force fresh server-side session
      window.location.href = "/admin";
    } finally {
      setActivating(false);
    }
  };

  const handleConfigure = async (data: { country: string; erp: string }) => {
    setConfig(data);
    // Persist initial settings for this org
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          default_country:   data.country,
          default_currency:  data.country === "MX" ? "MXN" : "COP",
          document_language: "es",
          preferred_erp:     data.erp,
        }),
      });
    } catch {
      // Non-fatal — continue even if settings save fails
    }
    setStep(3);
  };

  const handleFinish = async () => {
    const btn = document.querySelector("[data-choice]") as HTMLButtonElement | null;
    const choice = btn?.dataset.choice;
    if (choice === "demo") {
      // Trigger demo seed
      try {
        await fetch("/api/demo/seed", { method: "POST" });
      } catch {
        // Non-fatal
      }
      router.push("/admin?demo=true");
    } else {
      router.push("/admin");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#F8FAFC" }}
    >
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
            >
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <span
              className="text-xl font-bold text-gray-900"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Anzu
            </span>
          </div>
          <h1
            className="text-2xl font-bold text-gray-900 mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Configura tu cuenta
          </h1>
          <p className="text-sm text-gray-500">Solo toma 2 minutos</p>
        </div>

        {/* Step progress */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[1, 2, 3].map((s, i) => (
            <div key={s} className="flex items-center gap-4">
              <StepIndicator step={s} current={effectiveStep} />
              {i < 2 && <ChevronRight className="w-4 h-4 text-gray-300" />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">

          {/* Step 1 — Create organization */}
          {effectiveStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "#FFF7ED" }}
                >
                  <Building2 className="w-5 h-5" style={{ color: "#F97316" }} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Crea tu organización</h2>
                  <p className="text-xs text-gray-500">
                    Todos los datos estarán aislados por empresa
                  </p>
                </div>
              </div>

              {/* Clerk org creation widget */}
              <CreateOrganization
                afterCreateOrganizationUrl="/onboarding"
                appearance={{
                  variables: {
                    colorPrimary: "#F97316",
                    colorBackground: "#ffffff",
                    borderRadius: "0.75rem",
                  },
                  elements: {
                    card: "shadow-none border-0 p-0",
                    headerTitle: "text-base font-bold text-gray-900",
                    headerSubtitle: "text-sm text-gray-500",
                    formButtonPrimary: "bg-orange-500 hover:bg-orange-600",
                  },
                }}
              />

              {/* Activate an existing org if user already has one */}
              {isLoaded && memberships.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-2 text-center">O continúa con una organización existente:</p>
                  <div className="space-y-2">
                    {memberships.map((m) => (
                      <button
                        key={m.organization.id}
                        onClick={() => handleActivateExisting(m.organization.id)}
                        disabled={activating}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors text-left disabled:opacity-60"
                      >
                        <div className="w-6 h-6 rounded bg-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {m.organization.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-orange-900 flex-1">{m.organization.name}</span>
                        {activating
                          ? <div className="w-3 h-3 border border-orange-500 border-t-transparent rounded-full animate-spin" />
                          : <ChevronRight className="w-3 h-3 text-orange-400" />
                        }
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Configure */}
          {effectiveStep === 2 && (
            <StepConfigure onNext={handleConfigure} />
          )}

          {/* Step 3 — Quick start */}
          {effectiveStep === 3 && (
            <StepQuickStart onFinish={handleFinish} />
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Puedes cambiar esta configuración en cualquier momento desde Ajustes
        </p>
      </div>
    </div>
  );
}

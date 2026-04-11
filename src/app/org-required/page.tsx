// Anzu Dynamics — Organization Required Page
// Shown when an authenticated user tries to access a protected route without
// having an active Clerk organization (e.g. first login, no org created yet).
// Guides them to create or join one before continuing.

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useOrganizationList, useClerk } from "@clerk/nextjs";
import { Building2, Plus, ArrowRight, AlertCircle } from "lucide-react";
import { Suspense } from "react";

function OrgRequiredContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return_to") ?? "/admin";
  const [activating, setActivating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // useClerk().setActive is the canonical way to switch the active org.
  // useOrganizationList's setActive is typed as optional and can be undefined.
  const clerk = useClerk();
  const { userMemberships, isLoaded } = useOrganizationList({ userMemberships: true });

  const memberships = userMemberships?.data ?? [];
  const hasOrgs = isLoaded && memberships.length > 0;

  const handleSelect = async (orgId: string) => {
    setActivating(orgId);
    setError(null);
    try {
      await clerk.setActive({ organization: orgId });
      // router.refresh() tells Next.js to re-fetch server data with the fresh
      // Clerk cookie (orgId now set). router.push() then navigates; the
      // middleware will see the updated session and allow the request through.
      // window.location.href races against Clerk writing the cookie and fails.
      router.refresh();
      router.push(returnTo);
    } catch (err) {
      console.error("[org-required] setActive error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo activar la organización. Intenta de nuevo."
      );
      setActivating(null);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#F8FAFC" }}
    >
      <div className="w-full max-w-sm text-center">
        {/* Icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
        >
          <Building2 className="w-8 h-8 text-white" />
        </div>

        <h1
          className="text-xl font-bold text-gray-900 mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Se requiere una organización
        </h1>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
          Para acceder al dashboard de Anzu necesitas pertenecer a una organización.
          {hasOrgs ? " Selecciona una de tus organizaciones:" : " Crea una nueva para continuar."}
        </p>

        {/* Error message */}
        {error && (
          <div className="flex items-start gap-2 text-left bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          {/* Loading state while Clerk resolves memberships */}
          {!isLoaded && (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Existing orgs — shown first if available */}
          {hasOrgs && memberships.map((m) => (
            <button
              key={m.organization.id}
              onClick={() => void handleSelect(m.organization.id)}
              disabled={activating !== null}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-orange-500 bg-orange-50 text-left hover:bg-orange-100 transition-colors disabled:opacity-60"
            >
              <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center shrink-0 text-white font-bold text-sm">
                {m.organization.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-orange-900">{m.organization.name}</div>
                <div className="text-xs text-orange-700">Tu rol: {m.role}</div>
              </div>
              {activating === m.organization.id
                ? <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                : <ArrowRight className="w-4 h-4 text-orange-500" />
              }
            </button>
          ))}

          {/* Create new org */}
          {isLoaded && (
            <button
              onClick={() => router.push("/onboarding")}
              disabled={activating !== null}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white text-left hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <Plus className="w-4 h-4 text-gray-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-900">Crear nueva organización</div>
                <div className="text-xs text-gray-500">Para tu empresa o equipo</div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-6">
          ¿Necesitas ayuda?{" "}
          <a href="mailto:soporte@anzudynamics.com" className="text-orange-500 hover:underline">
            Contacta soporte
          </a>
        </p>
      </div>
    </div>
  );
}

export default function OrgRequiredPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F8FAFC" }}>
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <OrgRequiredContent />
    </Suspense>
  );
}

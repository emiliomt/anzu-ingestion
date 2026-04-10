// Anzu Dynamics — Organization Required Page
// Shown when an authenticated user tries to access a protected route without
// having an active Clerk organization (e.g. first login, no org created yet).
// Guides them to create or join one before continuing.

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useOrganizationList } from "@clerk/nextjs";
import { Building2, Plus, Users, ArrowRight } from "lucide-react";
import { Suspense } from "react";

function OrgRequiredContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return_to") ?? "/admin";
  const { userMemberships, isLoaded } = useOrganizationList({ userMemberships: true });

  const hasOrgs = isLoaded && (userMemberships?.count ?? 0) > 0;

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
          Para acceder al dashboard de Anzu necesitas pertenecer a una organización
          (empresa cliente). Crea una nueva o únete a una existente.
        </p>

        <div className="space-y-3">
          {/* Create new org */}
          <button
            onClick={() => router.push("/onboarding")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-orange-500 bg-orange-50 text-left hover:bg-orange-100 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-orange-900">Crear nueva organización</div>
              <div className="text-xs text-orange-700">Para tu empresa o equipo</div>
            </div>
            <ArrowRight className="w-4 h-4 text-orange-500" />
          </button>

          {/* Switch to existing org if user has memberships */}
          {hasOrgs && (
            <button
              onClick={() => router.push("/admin")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white text-left hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-gray-600" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-gray-900">
                  Seleccionar organización existente
                </div>
                <div className="text-xs text-gray-500">
                  Tienes {userMemberships?.count} membresía{userMemberships?.count !== 1 ? "s" : ""}
                </div>
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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: "#F8FAFC" }}><div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <OrgRequiredContent />
    </Suspense>
  );
}

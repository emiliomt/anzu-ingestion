// Anzu Dynamics — Organization Required Page
// Shown when an authenticated user tries to access a protected route without
// having an active Clerk organization (e.g. first login, no org created yet).
// Uses Clerk's <OrganizationSwitcher> to handle session refresh + org activation
// natively — avoids the setActive() API call that can hang in production.

"use client";

import { useSearchParams } from "next/navigation";
import { OrganizationSwitcher, CreateOrganization } from "@clerk/nextjs";
import { Building2 } from "lucide-react";
import { Suspense } from "react";

function OrgRequiredContent() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return_to") ?? "/admin";

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
          Selecciona tu organización para continuar, o crea una nueva.
        </p>

        {/* Clerk's OrganizationSwitcher handles setActive + session refresh natively */}
        <div className="flex flex-col items-center gap-4">
          <OrganizationSwitcher
            hidePersonal
            afterSelectOrganizationUrl={returnTo}
            afterCreateOrganizationUrl={returnTo}
            appearance={{
              elements: {
                rootBox: "w-full",
                organizationSwitcherTrigger:
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-orange-500 bg-orange-50 hover:bg-orange-100 transition-colors text-orange-900 font-semibold text-sm",
                organizationSwitcherTriggerIcon: "text-orange-500",
                organizationPreviewAvatarBox: "w-9 h-9 rounded-lg",
                organizationPreviewTextContainer: "text-left",
                organizationPreviewMainIdentifier: "text-sm font-semibold text-orange-900",
                organizationPreviewSecondaryIdentifier: "text-xs text-orange-700",
              },
              variables: {
                colorPrimary: "#F97316",
                colorBackground: "#ffffff",
                borderRadius: "0.75rem",
              },
            }}
          />

          <p className="text-xs text-gray-400">
            ¿No ves tu organización?{" "}
            <a href="/onboarding" className="text-orange-500 hover:underline font-medium">
              Crear una nueva
            </a>
          </p>
        </div>

        <p className="text-xs text-gray-400 mt-8">
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
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "#F8FAFC" }}
        >
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <OrgRequiredContent />
    </Suspense>
  );
}

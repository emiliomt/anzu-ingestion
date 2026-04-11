// Anzu Dynamics — Organization Required Page
// Shown only when a user has NO organization memberships at all.
// (Users with an existing org are now handled transparently by the middleware
// fallback — they go directly to /admin without needing to interact here.)

"use client";

import { useRouter } from "next/navigation";
import { Building2, Plus } from "lucide-react";

export default function OrgRequiredPage() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "#F8FAFC" }}
    >
      <div className="w-full max-w-sm text-center">
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
          Para acceder al dashboard necesitas pertenecer a una organización.
          Crea una nueva para continuar.
        </p>

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
        </button>

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

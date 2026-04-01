"use client";

/**
 * /provider — Provider invoice upload portal
 * ─────────────────────────────────────────────────────────────────────────────
 * The primary page for PROVIDER users. Requires selecting a connected client
 * organization before uploading. Passes the organizationId to the upload API.
 */

import { useState } from "react";
import { FileText, Shield, Zap, CheckCircle2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { ClientSelector } from "@/components/provider/ClientSelector";
import { UploadZone } from "@/components/UploadZone";
import { StatusTracker } from "@/app/StatusTracker";

export default function ProviderUploadPage() {
  const { user } = useUser();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Hero */}
      <div
        className="px-6 py-8 border-b"
        style={{ background: "linear-gradient(135deg, #0C1B3A 0%, #1E3A5F 100%)", borderColor: "rgba(255,255,255,0.08)" }}
      >
        <div className="max-w-2xl">
          <h1
            className="text-2xl font-bold text-white mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Upload Invoice
          </h1>
          <p className="text-sm text-blue-200">
            Select the company you&apos;re billing and upload your invoice. We&apos;ll extract
            all data automatically.
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Client selector — required first */}
        <div
          className="bg-white rounded-2xl border border-gray-100 p-6"
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#EFF6FF" }}
            >
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Step 1 — Select Client</h2>
              <p className="text-xs text-gray-500">Choose which company this invoice is for</p>
            </div>
          </div>
          <ClientSelector onChange={setSelectedOrgId} />
        </div>

        {/* Upload zone — enabled only after client is selected */}
        <div
          className={`bg-white rounded-2xl border p-6 transition-opacity ${
            selectedOrgId ? "opacity-100" : "opacity-50 pointer-events-none"
          }`}
          style={{
            borderColor: selectedOrgId ? "#E2E8F0" : "#E2E8F0",
            boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#FFF7ED" }}
            >
              <FileText className="w-4 h-4" style={{ color: "#F97316" }} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Step 2 — Upload File</h2>
              <p className="text-xs text-gray-500">
                {selectedOrgId
                  ? "Drag your PDF, image, or XML invoice"
                  : "Select a client above to enable upload"}
              </p>
            </div>
          </div>

          {user?.primaryEmailAddress?.emailAddress && (
            <p className="text-xs text-emerald-600 mb-3 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Submitting as <strong className="ml-1">{user.primaryEmailAddress.emailAddress}</strong>
            </p>
          )}

          <UploadZone
            prefilledEmail={user?.primaryEmailAddress?.emailAddress ?? ""}
            organizationId={selectedOrgId ?? undefined}
          />
        </div>

        {/* Trust signals */}
        <div
          className="bg-white rounded-2xl border border-gray-100 p-4"
          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
        >
          <div className="flex flex-col sm:flex-row gap-4">
            {[
              { icon: Shield,       color: "#10B981", label: "End-to-end encrypted", sub: "All data encrypted in transit and at rest" },
              { icon: Zap,          color: "#F97316", label: "AI extraction in &lt;2 min", sub: "Automatic field recognition" },
              { icon: CheckCircle2, color: "#2563EB", label: "7-year record retention", sub: "DIAN & SAT compliant archiving" },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.label} className="flex items-center gap-3 flex-1">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${t.color}15` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: t.color }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800"
                       dangerouslySetInnerHTML={{ __html: t.label }} />
                    <p className="text-xs text-gray-500">{t.sub}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status tracker */}
        <div
          className="bg-white rounded-2xl border border-gray-100 p-6"
          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
        >
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Track a previously submitted invoice</h3>
          <p className="text-xs text-gray-500 mb-4">Enter your reference number to check processing status.</p>
          <StatusTracker />
        </div>
      </div>
    </div>
  );
}

// Anzu Dynamics — Onboarding Wizard (placeholder)
// Full 3-step wizard implemented in Step 4:
//   Step 1: Connect ERP (select type + enter credentials → saved to vault)
//   Step 2: Upload test invoice (PDF or CFDI XML)
//   Step 3: Run full pipeline → see results
//
// Redirected here after sign-up and when org has no ERP credentials configured.

export default function OnboardingPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#F8FAFC" }}
    >
      <div className="text-center max-w-md px-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
        >
          <span className="text-white font-bold text-lg">A</span>
        </div>
        <h1
          className="text-2xl font-bold text-gray-900 mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Welcome to Anzu
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          Onboarding wizard coming in Step 4. Your account and organization are
          set up successfully.
        </p>
        <a
          href="/admin"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
        >
          Go to Admin Dashboard →
        </a>
      </div>
    </div>
  );
}

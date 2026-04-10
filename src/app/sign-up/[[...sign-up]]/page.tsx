// Anzu Dynamics — Sign-Up Page
// New users register here. Clerk creates the user + prompts org creation.
// After sign-up, redirects to /dashboard/onboarding to connect their first ERP.

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "#F8FAFC" }}
    >
      {/* Anzu logo / brand mark */}
      <div className="mb-8 text-center">
        <div
          className="inline-flex items-center gap-2 mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
          >
            <span className="text-white font-bold text-sm">A</span>
          </div>
          <span className="text-xl font-bold text-gray-900">Anzu</span>
        </div>
        <p className="text-sm text-gray-500">Start automating your invoice process today</p>
      </div>

      {/* Clerk sign-up widget */}
      <SignUp
        fallbackRedirectUrl="/onboarding"
        appearance={{
          variables: {
            colorPrimary: "#F97316",
            colorBackground: "#ffffff",
            borderRadius: "0.75rem",
          },
        }}
      />
    </div>
  );
}

"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginCard() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/admin";
  const hasError = searchParams.get("error") === "CredentialsSignin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await signIn("credentials", { email, password, callbackUrl });
    setLoading(false);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #0C1B3A 0%, #1E3A5F 100%)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: "#fff", boxShadow: "0 24px 64px rgba(0,0,0,0.24)" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-lg font-bold"
            style={{ background: "linear-gradient(135deg, #F97316, #EA580C)" }}
          >
            A
          </div>
          <span className="text-xl font-semibold text-gray-900" style={{ fontFamily: "Jost, sans-serif" }}>
            Anzu
          </span>
        </div>

        <h1
          className="text-2xl font-semibold text-gray-900 mb-1"
          style={{ fontFamily: "Jost, sans-serif" }}
        >
          Sign in
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Sign in to access the invoice dashboard.
        </p>

        {/* Google sign-in button */}
        <button
          onClick={() => signIn("google", { callbackUrl })}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          style={{ borderColor: "#E2E8F0" }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
              fill="#4285F4"
            />
            <path
              d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
              fill="#34A853"
            />
            <path
              d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Credentials form */}
        <form onSubmit={handleCredentials} className="flex flex-col gap-3">
          {hasError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Invalid email or password.
            </p>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl border text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2"
            style={{ borderColor: "#E2E8F0" }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl border text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2"
            style={{ borderColor: "#E2E8F0" }}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #4f46e5, #4338ca)" }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Access restricted to authorized team members.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginCard />
    </Suspense>
  );
}

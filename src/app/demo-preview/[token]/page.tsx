// Anzu Dynamics — Shareable Demo Preview Page (placeholder)
// Full implementation in Step 6.
// No login required. Token is a signed JWT (DEMO_JWT_SECRET, 30-min TTL).
// Shows a read-only view of seeded demo invoices + VAT recovery metrics.

export default function DemoPreviewPage({
  params,
}: {
  params: { token: string };
}) {
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
          Anzu Live Demo
        </h1>
        <p className="text-gray-500 text-sm mb-2">
          Token: <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{params.token.slice(0, 12)}…</code>
        </p>
        <p className="text-gray-500 text-sm">
          Interactive demo preview implemented in Step 6.
        </p>
      </div>
    </div>
  );
}

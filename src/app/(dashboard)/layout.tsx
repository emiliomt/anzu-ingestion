// Anzu Dynamics — Dashboard Layout (Multi-Tenant Shell)
// Wraps all protected dashboard pages with sidebar navigation.
// Implemented fully in Step 4 (Next.js dashboard + onboarding wizard).

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Full sidebar + topbar shell implemented in Step 4.
  // Keeping this as a passthrough for now to unblock route scaffolding.
  return <>{children}</>;
}

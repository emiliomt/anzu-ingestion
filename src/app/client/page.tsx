/**
 * /client — CLIENT dashboard home
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows the invoice dashboard scoped to the CLIENT's organization.
 * Metric calls automatically return only this org's data (tenant filter in API).
 *
 * This is a Server Component — fetches org info from the DB for the page header.
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Reuse the existing admin dashboard components (they call the same API routes,
// which now automatically apply tenant filters for CLIENT users).
import AdminDashboard from "@/app/admin/page";

export default async function ClientDashboardPage() {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const profile = await prisma.userProfile.findUnique({
    where: { clerkUserId: userId },
    include: { organization: { select: { name: true, plan: true } } },
  });

  if (!profile || profile.role !== "CLIENT") {
    redirect("/setup");
  }

  if (!profile.organization) {
    redirect("/setup");
  }

  // Delegate to the admin dashboard — it now respects tenant filters via the API
  return <AdminDashboard />;
}

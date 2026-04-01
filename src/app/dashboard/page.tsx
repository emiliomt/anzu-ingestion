/**
 * /dashboard — Smart redirect based on user role
 * ─────────────────────────────────────────────────────────────────────────────
 * Redirects authenticated users to their role's home portal.
 * This page is used as the post-login redirect target in Clerk configuration.
 *
 * Clerk sign-in redirect → /dashboard → role-based portal
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getRoleHome } from "@/lib/auth";

export default async function DashboardPage() {
  const { userId } = auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Look up user profile to determine their role
  const profile = await prisma.userProfile.findUnique({
    where: { clerkUserId: userId },
    select: { role: true },
  });

  if (!profile) {
    // No profile yet → onboarding
    redirect("/setup");
  }

  const home = getRoleHome(profile.role as "ADMIN" | "CLIENT" | "PROVIDER");
  redirect(home);
}

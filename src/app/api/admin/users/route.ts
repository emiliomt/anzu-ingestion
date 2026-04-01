/**
 * GET /api/admin/users — List all users with roles (ADMIN only)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminOnly } from "@/lib/api-guard";

export const dynamic = "force-dynamic";

export const GET = adminOnly(async () => {
  const users = await prisma.userProfile.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      organization: {
        select: { id: true, name: true, slug: true, plan: true },
      },
      providerConnections: {
        select: { status: true, organization: { select: { name: true } } },
      },
    },
  });

  return NextResponse.json({ users });
}, "user.list");

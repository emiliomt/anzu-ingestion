// Anzu Dynamics — Public Vendor Search API
// GET /api/vendors/search?q=<query>
// Public endpoint (no Clerk auth required) — used from the unauthenticated vendor portal
// so vendors can identify themselves before uploading an invoice.
// Returns only id + name; sensitive fields (email, phone, address, organizationId) are excluded.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();

  // Require at least 2 characters to avoid dumping the entire vendor table
  if (q.length < 2) {
    return NextResponse.json({ vendors: [] });
  }

  const vendors = await prisma.vendor.findMany({
    where: {
      name: { contains: q, mode: "insensitive" },
    },
    select: {
      id: true,
      name: true,
      // organizationId intentionally excluded — clients must not learn routing IDs
    },
    orderBy: { name: "asc" },
    take: 10,
  });

  return NextResponse.json({ vendors });
}

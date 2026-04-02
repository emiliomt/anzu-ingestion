/**
 * GET  /api/client/settings — Return org details for the logged-in CLIENT
 * PATCH /api/client/settings — Update org name, taxId, country (not plan)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionContext } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Both CLIENT and ADMIN can read — billing page needs this for both roles
  const org = ctx.organization;
  if (!org && ctx.role !== "ADMIN") {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }
  return NextResponse.json({ org });
}

const PatchSchema = z.object({
  name:    z.string().min(2).max(100).optional(),
  taxId:   z.string().max(30).optional(),
  country: z.string().length(2).optional(),
});

export async function PATCH(req: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "CLIENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orgId = ctx.organizationId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
  }

  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: parsed.data,
  });

  return NextResponse.json({ org: updated });
}

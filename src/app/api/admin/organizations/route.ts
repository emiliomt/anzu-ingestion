/**
 * /api/admin/organizations — Organization CRUD (ADMIN only)
 * ─────────────────────────────────────────────────────────────────────────────
 * GET  — List all organizations with user/invoice counts
 * POST — Create a new organization (tenant)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminOnly } from "@/lib/api-guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET /api/admin/organizations
export const GET = adminOnly(async () => {
  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          users: true,
          invoices: true,
          providerConnections: true,
        },
      },
    },
  });

  return NextResponse.json({ organizations });
}, "organization.list");

const CreateOrgSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  taxId: z.string().optional(),
  country: z.string().length(2).default("CO"),
  plan: z.enum(["Starter", "Growth", "Enterprise"]).default("Starter"),
});

// POST /api/admin/organizations
export const POST = adminOnly(async (req: NextRequest, ctx) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateOrgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  // Check slug uniqueness
  const existing = await prisma.organization.findUnique({
    where: { slug: parsed.data.slug },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Organization slug '${parsed.data.slug}' is already taken` },
      { status: 409 }
    );
  }

  const org = await prisma.organization.create({
    data: parsed.data,
  });

  // Write audit log entry
  await prisma.auditLog.create({
    data: {
      actorClerkUserId: ctx.clerkUserId,
      actorRole: ctx.role,
      action: "organization.create",
      resourceType: "Organization",
      resourceId: org.id,
      metadata: JSON.stringify({ name: org.name, plan: org.plan }),
    },
  });

  return NextResponse.json({ organization: org }, { status: 201 });
}, "organization.create");

/**
 * /api/admin/organizations/[id] — Single org operations (ADMIN only)
 * ─────────────────────────────────────────────────────────────────────────────
 * GET   — Get organization details
 * PATCH — Update organization (name, plan, isActive)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminOnly } from "@/lib/api-guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET /api/admin/organizations/[id]
export const GET = adminOnly(
  async (_req: NextRequest, _ctx, params?: { id?: string }) => {
    const org = await prisma.organization.findUnique({
      where: { id: params?.id },
      include: {
        users: {
          select: {
            id: true, clerkUserId: true, role: true,
            firstName: true, lastName: true, email: true,
            isActive: true, createdAt: true,
          },
        },
        _count: { select: { invoices: true, purchaseOrders: true, projects: true } },
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({ organization: org });
  }
);

const PatchOrgSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  taxId: z.string().optional(),
  plan: z.enum(["Starter", "Growth", "Enterprise"]).optional(),
  isActive: z.boolean().optional(),
});

// PATCH /api/admin/organizations/[id]
export const PATCH = adminOnly(
  async (req: NextRequest, ctx, params?: { id?: string }) => {
    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = PatchOrgSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    const org = await prisma.organization.update({
      where: { id: params?.id },
      data: parsed.data,
    });

    await prisma.auditLog.create({
      data: {
        actorClerkUserId: ctx.clerkUserId,
        actorRole: ctx.role,
        action: "organization.update",
        resourceType: "Organization",
        resourceId: org.id,
        metadata: JSON.stringify(parsed.data),
      },
    });

    return NextResponse.json({ organization: org });
  }
);

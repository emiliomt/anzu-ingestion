// Anzu Dynamics — Tenant API
// GET  /api/tenant — returns current org info, plan, and member count
// PATCH /api/tenant — update tenant metadata (admin only)

import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { requireAnyRole, requireAdmin, RoleError } from "@/lib/roles";
import { checkQuota } from "@/lib/quota";

export const dynamic = "force-dynamic";

// ── GET /api/tenant ────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const { orgId, userId, role } = await requireAnyRole();

    // Fetch Clerk org details, subscription, member count, and quota in parallel
    const client = await clerkClient();
    const [org, subscription, memberships, quota] = await Promise.all([
      client.organizations.getOrganization({ organizationId: orgId }),
      prisma.subscription.findUnique({ where: { organizationId: orgId } }),
      client.organizations.getOrganizationMembershipList({ organizationId: orgId }),
      checkQuota(orgId),
    ]);

    return NextResponse.json({
      organization: {
        id:          orgId,
        name:        org.name,
        slug:        org.slug,
        imageUrl:    org.imageUrl,
        createdAt:   org.createdAt,
        memberCount: memberships.totalCount,
      },
      invoicesThisMonth: quota.used,
      subscription: subscription
        ? {
            plan:            subscription.plan,
            status:          subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
            cancelAtPeriodEnd: false,
          }
        : {
            plan:            "demo",
            status:          "active",
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
          },
      currentUser: {
        id:   userId,
        role,
      },
    });
  } catch (err) {
    if (err instanceof RoleError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[tenant GET]", err);
    return NextResponse.json({ error: "Failed to load tenant info" }, { status: 500 });
  }
}

// ── PATCH /api/tenant ──────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const { orgId } = await requireAdmin();

    const body = await req.json() as {
      name?: string;
      preferredErp?: string;
    };

    const updates: Record<string, unknown> = {};

    if (body.name && typeof body.name === "string") {
      const trimmed = body.name.trim();
      if (trimmed.length < 2 || trimmed.length > 64) {
        return NextResponse.json(
          { error: "Organization name must be 2–64 characters" },
          { status: 400 }
        );
      }
      // Update org name in Clerk
      const client = await clerkClient();
      await client.organizations.updateOrganization(orgId, { name: trimmed });
      updates.name = trimmed;
    }

    if (body.preferredErp && typeof body.preferredErp === "string") {
      // Save preferred ERP as a tenant setting
      await prisma.setting.upsert({
        where: { organizationId_key: { organizationId: orgId, key: "preferred_erp" } },
        update: { value: body.preferredErp },
        create: { organizationId: orgId, key: "preferred_erp", value: body.preferredErp },
      });
      updates.preferredErp = body.preferredErp;
    }

    return NextResponse.json({ success: true, updated: updates });
  } catch (err) {
    if (err instanceof RoleError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[tenant PATCH]", err);
    return NextResponse.json({ error: "Failed to update tenant" }, { status: 500 });
  }
}

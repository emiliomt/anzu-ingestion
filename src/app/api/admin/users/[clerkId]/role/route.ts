/**
 * PATCH /api/admin/users/[clerkId]/role — Assign role to a user (ADMIN only)
 * ─────────────────────────────────────────────────────────────────────────────
 * Updates UserProfile.role in the DB AND syncs it to Clerk publicMetadata
 * so the middleware picks it up on the user's next request.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminOnly } from "@/lib/api-guard";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PatchRoleSchema = z.object({
  role: z.enum(["ADMIN", "CLIENT", "PROVIDER"]),
  organizationId: z.string().optional(),
});

export const PATCH = adminOnly(
  async (req: NextRequest, ctx, params?: { clerkId?: string }) => {
    const targetClerkId = params?.clerkId;
    if (!targetClerkId) {
      return NextResponse.json({ error: "clerkId parameter required" }, { status: 400 });
    }

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = PatchRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", issues: parsed.error.issues }, { status: 400 });
    }

    const { role, organizationId } = parsed.data;

    // Validate org if assigning CLIENT role
    if (role === "CLIENT" && !organizationId) {
      return NextResponse.json({ error: "organizationId required for CLIENT role" }, { status: 400 });
    }

    // Update DB
    const profile = await prisma.userProfile.update({
      where: { clerkUserId: targetClerkId },
      data: { role, organizationId: organizationId ?? null },
    });

    // Sync to Clerk JWT so middleware picks up the role on next request
    try {
      await clerkClient().users.updateUserMetadata(targetClerkId, {
        publicMetadata: { role },
      });
    } catch (err) {
      console.error("[admin/users/role] Clerk metadata sync failed:", err);
      // Non-fatal — DB is source of truth
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorClerkUserId: ctx.clerkUserId,
        actorRole: ctx.role,
        action: "user.role_assign",
        resourceType: "UserProfile",
        resourceId: profile.id,
        metadata: JSON.stringify({ newRole: role, organizationId }),
      },
    });

    return NextResponse.json({ success: true, profile: { id: profile.id, role: profile.role } });
  }
);

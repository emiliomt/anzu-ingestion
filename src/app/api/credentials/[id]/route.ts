// Anzu Dynamics — ERP Credential Vault — Single Credential API
// GET    /api/credentials/[id] — fetch credential metadata (no secrets)
// PATCH  /api/credentials/[id] — update label or re-encrypt with new data
// DELETE /api/credentials/[id] — delete credential (cross-tenant guard)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, RoleError } from "@/lib/roles";
import { encryptErpCredential } from "@/lib/vault";
import { isSameTenant } from "@/lib/tenant";
import type { ErpCredentialData } from "@/lib/vault";

export const dynamic = "force-dynamic";

// ── GET /api/credentials/[id] ──────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await requireAdmin();
    const { id } = await params;

    const credential = await prisma.erpCredential.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        erpType: true,
        label: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!credential || !isSameTenant(credential.organizationId, orgId)) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    return NextResponse.json(credential);
  } catch (err) {
    if (err instanceof RoleError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[credentials/[id] GET]", err);
    return NextResponse.json({ error: "Failed to load credential" }, { status: 500 });
  }
}

// ── PATCH /api/credentials/[id] ───────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await requireAdmin();
    const { id } = await params;

    const existing = await prisma.erpCredential.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });

    if (!existing || !isSameTenant(existing.organizationId, orgId)) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      label?: string;
      erpType?: string;
      data?: ErpCredentialData;
    };

    const updateData: Record<string, unknown> = {};
    if (body.label)   updateData.label   = body.label;
    if (body.erpType) updateData.erpType = body.erpType;

    if (body.data) {
      const { encryptedData, iv, authTag } = encryptErpCredential(body.data);
      updateData.encryptedData = encryptedData;
      updateData.iv            = iv;
      updateData.authTag       = authTag;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const updated = await prisma.erpCredential.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        organizationId: true,
        erpType: true,
        label: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof RoleError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[credentials/[id] PATCH]", err);
    return NextResponse.json({ error: "Failed to update credential" }, { status: 500 });
  }
}

// ── DELETE /api/credentials/[id] ──────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await requireAdmin();
    const { id } = await params;

    const credential = await prisma.erpCredential.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });

    if (!credential || !isSameTenant(credential.organizationId, orgId)) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    await prisma.erpCredential.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof RoleError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[credentials/[id] DELETE]", err);
    return NextResponse.json({ error: "Failed to delete credential" }, { status: 500 });
  }
}

// Anzu Dynamics — ERP Credential Vault API
// GET  /api/credentials — list encrypted credentials for current org (admin only)
// POST /api/credentials — create a new encrypted ERP credential (admin only)
//
// Credentials are never returned in decrypted form via the API.
// Decryption happens only inside the RPA worker process and the /test endpoint.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, RoleError } from "@/lib/roles";
import { encryptErpCredential } from "@/lib/vault";
import type { ErpCredentialData } from "@/lib/vault";

export const dynamic = "force-dynamic";

// ── GET /api/credentials ───────────────────────────────────────────────────────

export async function GET() {
  try {
    const { orgId } = await requireAdmin();

    const credentials = await prisma.erpCredential.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        organizationId: true,
        erpType: true,
        label: true,
        createdAt: true,
        updatedAt: true,
        // Never select encryptedData, iv, authTag — keep secrets server-side only
      },
    });

    return NextResponse.json({ credentials });
  } catch (err) {
    if (err instanceof RoleError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[credentials GET]", err);
    return NextResponse.json({ error: "Failed to load credentials" }, { status: 500 });
  }
}

// ── POST /api/credentials ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { orgId } = await requireAdmin();

    const body = (await request.json()) as {
      erpType: string;
      label: string;
      data: ErpCredentialData;
    };

    if (!body.erpType || !body.label || !body.data) {
      return NextResponse.json(
        { error: "erpType, label, and data are required" },
        { status: 400 }
      );
    }

    const { encryptedData, iv, authTag } = encryptErpCredential(body.data);

    const credential = await prisma.erpCredential.create({
      data: {
        organizationId: orgId,
        erpType: body.erpType,
        label: body.label,
        encryptedData,
        iv,
        authTag,
      },
      select: {
        id: true,
        organizationId: true,
        erpType: true,
        label: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(credential, { status: 201 });
  } catch (err) {
    if (err instanceof RoleError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[credentials POST]", err);
    return NextResponse.json({ error: "Failed to create credential" }, { status: 500 });
  }
}

// Anzu Dynamics — ERP Credential Connection Test
// POST /api/credentials/[id]/test
//
// Decrypts the stored credential and tests connectivity to the ERP.
// In demo / no-Playwright mode: returns a simulated success after ~800ms.
// In production mode (PLAYWRIGHT_ENABLED=true): does a real HTTP/browser ping.
//
// The decrypted credential is NEVER returned to the client — it stays server-side.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, RoleError } from "@/lib/roles";
import { decryptErpCredential } from "@/lib/vault";
import { isSameTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await requireAdmin();
    const { id } = await params;

    const credential = await prisma.erpCredential.findUnique({
      where: { id },
    });

    if (!credential || !isSameTenant(credential.organizationId, orgId)) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    // Decrypt — server-side only, never sent to client
    const credentialData = decryptErpCredential({
      encryptedData: credential.encryptedData,
      iv: credential.iv,
      authTag: credential.authTag,
    });

    const start = Date.now();
    let success = false;
    let message = "";

    const playwrightEnabled = process.env.PLAYWRIGHT_ENABLED === "true";

    if (!playwrightEnabled || credential.erpType === "mock") {
      // ── Demo / mock mode — simulate a connection test ──────────────────────
      await new Promise((resolve) => setTimeout(resolve, 800));
      success = true;
      message = `Connection to ${credential.label} (${credential.erpType}) successful`;
    } else {
      // ── Real connectivity test — try an HTTP ping to the ERP base URL ──────
      const baseUrl = credentialData.baseUrl;
      if (!baseUrl) {
        return NextResponse.json(
          { error: "No baseUrl configured for this credential" },
          { status: 400 }
        );
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const resp = await fetch(baseUrl, {
          method: "HEAD",
          signal: controller.signal,
          headers: credentialData.apiKey
            ? { Authorization: `Bearer ${credentialData.apiKey}` }
            : {},
        });
        clearTimeout(timeout);

        // A 2xx or 3xx response means the server is reachable
        success = resp.status < 500;
        message = success
          ? `Server reachable at ${baseUrl} (HTTP ${resp.status})`
          : `Server returned HTTP ${resp.status}`;
      } catch (fetchErr) {
        success = false;
        message =
          fetchErr instanceof Error && fetchErr.name === "AbortError"
            ? `Connection timed out after 5s (${baseUrl})`
            : `Connection failed: ${fetchErr instanceof Error ? fetchErr.message : "Unknown error"}`;
      }
    }

    const latencyMs = Date.now() - start;

    return NextResponse.json({ success, latencyMs, message, erpType: credential.erpType });
  } catch (err) {
    if (err instanceof RoleError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[credentials/[id]/test POST]", err);
    return NextResponse.json({ error: "Connection test failed" }, { status: 500 });
  }
}

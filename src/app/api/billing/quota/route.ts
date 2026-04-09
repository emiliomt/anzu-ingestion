// Anzu Dynamics — Quota Status API
// GET /api/billing/quota — returns the current org's invoice quota status.
// Used by the Settings billing tab and the upload route to enforce limits.

import { NextResponse } from "next/server";
import { requireOrgId } from "@/lib/tenant";
import { checkQuota } from "@/lib/quota";
import { RoleError } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const orgId = await requireOrgId();
    const quota = await checkQuota(orgId);
    return NextResponse.json(quota);
  } catch (err) {
    if (err instanceof RoleError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[billing/quota GET]", err);
    return NextResponse.json({ error: "Failed to load quota" }, { status: 500 });
  }
}

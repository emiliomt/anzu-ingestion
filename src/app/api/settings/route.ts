// Anzu Dynamics — Settings API (tenant-scoped)
// GET  /api/settings — return settings for current org (with global fallback)
// POST /api/settings — persist partial updates for current org (admin only)

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSettings, saveSettings } from "@/lib/app-settings";
import { requireAdmin, RoleError } from "@/lib/roles";

export const dynamic = "force-dynamic";

// ── GET /api/settings ──────────────────────────────────────────────────────────

export async function GET() {
  try {
    const { orgId } = await auth();
    // Return settings scoped to the current org (with global fallback)
    const settings = await getSettings(orgId ?? null);
    return NextResponse.json(settings);
  } catch (err) {
    console.error("[settings GET]", err);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

// ── POST /api/settings — admin only ───────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { orgId } = await requireAdmin();

    const body = await req.json() as Record<string, unknown>;

    // Coerce every value to string for the key-value store
    const partial: Record<string, string> = {};
    for (const [key, val] of Object.entries(body)) {
      if (val === null || val === undefined) {
        partial[key] = "null";
      } else if (Array.isArray(val)) {
        partial[key] = JSON.stringify(val);
      } else {
        partial[key] = String(val);
      }
    }

    await saveSettings(partial, orgId);
    const updated = await getSettings(orgId);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof RoleError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[settings POST]", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/training/set-model
 * Body: { modelId: string }
 *
 * Persists a fine-tuned model ID to the settings table so all subsequent
 * extractions use it. Uses raw SQL for compatibility across both the old
 * schema (key-only PK) and the new schema (organizationId + key composite PK).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { modelId?: unknown };
    const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";

    if (!modelId) {
      return NextResponse.json({ error: "modelId is required" }, { status: 400 });
    }

    // Try new schema first (composite PK: organizationId + key)
    try {
      await prisma.$executeRaw`
        INSERT INTO settings ("organizationId", key, value, "updatedAt")
        VALUES ('default', 'finetune_model_id', ${modelId}, datetime('now'))
        ON CONFLICT("organizationId", key) DO UPDATE SET value = excluded.value, "updatedAt" = excluded."updatedAt"
      `;
    } catch {
      // Fall back to old schema (key-only PK, no organizationId column)
      await prisma.$executeRaw`
        INSERT INTO settings (key, value, "updatedAt")
        VALUES ('finetune_model_id', ${modelId}, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, "updatedAt" = excluded."updatedAt"
      `;
    }

    return NextResponse.json({ modelId });
  } catch (err) {
    console.error("[training/set-model]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

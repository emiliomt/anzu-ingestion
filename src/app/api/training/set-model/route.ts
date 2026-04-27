import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/training/set-model
 * Body: { modelId: string }
 *
 * Persists a fine-tuned model ID to the settings table so all subsequent
 * extractions use it. Mirrors what scripts/set-finetune-model.ts does but
 * accessible at runtime without DB access.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { modelId?: unknown };
    const modelId = typeof body.modelId === "string" ? body.modelId.trim() : "";

    if (!modelId) {
      return NextResponse.json({ error: "modelId is required" }, { status: 400 });
    }

    await prisma.setting.upsert({
      where: { organizationId_key: { organizationId: "default", key: "finetune_model_id" } },
      update: { value: modelId },
      create: { organizationId: "default", key: "finetune_model_id", value: modelId },
    });

    return NextResponse.json({ modelId });
  } catch (err) {
    console.error("[training/set-model]", err);
    return NextResponse.json({ error: "Failed to save model ID" }, { status: 500 });
  }
}

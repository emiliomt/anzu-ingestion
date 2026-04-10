/**
 * One-shot script: persist a fine-tuned OpenAI model ID in the settings table
 * so that all subsequent invoice extractions use it automatically.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/set-finetune-model.ts
 *
 * Or run once via Prisma seed:
 *   npx prisma db seed
 *
 * The value set here overrides the gpt-4.1-mini fallback defined in
 * src/lib/claude.ts (EXTRACT_MODEL).  To revert to the base model, delete
 * the row or set the value to an empty string.
 */

import { PrismaClient } from "@prisma/client";

const MODEL_ID =
  "ft:gpt-4.1-mini-2025-04-14:anzu-dynamics:anzu-invoice-extractor-v3:DTEddxgu";

const prisma = new PrismaClient();

async function main() {
  await prisma.setting.upsert({
    where: {
      organizationId_key: { organizationId: "default", key: "finetune_model_id" },
    },
    update: { value: MODEL_ID },
    create: { organizationId: "default", key: "finetune_model_id", value: MODEL_ID },
  });

  const row = await prisma.setting.findUnique({
    where: {
      organizationId_key: { organizationId: "default", key: "finetune_model_id" },
    },
  });

  console.log("✅  finetune_model_id set to:", row?.value);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

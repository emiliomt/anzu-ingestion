/**
 * One-shot script: persist the fine-tuned VAT classifier model ID in the
 * settings table so that all subsequent line-item classification calls use it.
 *
 * Usage (after the fine-tune job succeeds):
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/set-vat-classifier-model.ts
 *
 * Find your model ID at: platform.openai.com → Fine-tuning → your job
 * It looks like: ft:gpt-4o-mini-2024-07-18:anzu-dynamics:anzu-vat-classifier-v1:XXXXXXXX
 *
 * To revert to the base model, delete the row or set the value to an empty string.
 */

import { PrismaClient } from "@prisma/client";

// ── Replace this with the actual model ID from your fine-tune job ──────────
const MODEL_ID = "ft:gpt-4.1-mini-2025-04-14:anzu-dynamics:anzu-vat-classifier-v1:REPLACE_ME";
// ──────────────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

async function main() {
  await prisma.setting.upsert({
    where: {
      organizationId_key: { organizationId: "default", key: "vat_classifier_model_id" },
    },
    update: { value: MODEL_ID },
    create: { organizationId: "default", key: "vat_classifier_model_id", value: MODEL_ID },
  });

  const row = await prisma.setting.findUnique({
    where: {
      organizationId_key: { organizationId: "default", key: "vat_classifier_model_id" },
    },
  });

  console.log("✅  vat_classifier_model_id set to:", row?.value);
  console.log();
  console.log("Next step: update src/lib/classifier.ts to read this setting key");
  console.log("and pass it as the `model` parameter to the chat.completions.create call.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

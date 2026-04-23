/**
 * One-shot script: persist the fine-tuned PO Matcher model ID in the
 * settings table so that all subsequent invoice-to-PO matching calls use it.
 *
 * Usage (after the fine-tune job succeeds):
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/set-po-matcher-model.ts
 *
 * Find your model ID at: platform.openai.com → Fine-tuning → your job
 * It looks like: ft:gpt-4o-mini-2024-07-18:anzu-dynamics:anzu-po-matcher-v1:XXXXXXXX
 *
 * To revert to the base model, delete the row or set the value to an empty string.
 */

import { PrismaClient } from "@prisma/client";

// ── Replace this with the actual model ID from your fine-tune job ──────────
const MODEL_ID = "ft:gpt-4o-mini-2024-07-18:anzu-dynamics:anzu-po-matcher-v1:REPLACE_ME";
// ──────────────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

async function main() {
  await prisma.setting.upsert({
    where: {
      organizationId_key: { organizationId: "default", key: "po_matcher_model_id" },
    },
    update: { value: MODEL_ID },
    create: { organizationId: "default", key: "po_matcher_model_id", value: MODEL_ID },
  });

  const row = await prisma.setting.findUnique({
    where: {
      organizationId_key: { organizationId: "default", key: "po_matcher_model_id" },
    },
  });

  console.log("✅  po_matcher_model_id set to:", row?.value);
  console.log();
  console.log("Next step: update src/lib/matcher.ts to read this setting key");
  console.log("and pass it as the `model` parameter to the chat.completions.create call.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

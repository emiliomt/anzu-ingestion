"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export interface GroundTruthResult {
  success: boolean;
  error?: string;
  fieldCount?: number;
}

/**
 * Snapshot the current (human-verified) extracted field values as ground truth
 * for AI fine-tuning.  Sets fineTuneStatus = "READY" so a training job can
 * pick up all invoices where this field equals "READY".
 */
export async function saveGroundTruth(
  invoiceId: string,
  correctionNotes?: string
): Promise<GroundTruthResult> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { extractedData: true },
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    // Build a flat { fieldName → value } snapshot from all extracted fields
    const correctedData: Record<string, string | null> = {};
    for (const field of invoice.extractedData) {
      correctedData[field.fieldName] = field.value;
    }

    const fieldCount = Object.keys(correctedData).length;

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        correctedData: JSON.stringify(correctedData),
        fineTuneStatus: "READY",
        correctedBy: "admin",
        ...(correctionNotes != null && correctionNotes.trim() !== ""
          ? { correctionNotes: correctionNotes.trim() }
          : {}),
      },
    });

    await prisma.ingestionEvent.create({
      data: {
        invoiceId,
        eventType: "ground_truth_saved",
        metadata: JSON.stringify({
          fieldCount,
          by: "admin",
          ...(correctionNotes ? { notes: correctionNotes } : {}),
        }),
      },
    });

    revalidatePath("/admin/invoices");
    revalidatePath("/admin");

    return { success: true, fieldCount };
  } catch (err) {
    console.error("[saveGroundTruth]", err);
    return { success: false, error: "Failed to save ground truth" };
  }
}

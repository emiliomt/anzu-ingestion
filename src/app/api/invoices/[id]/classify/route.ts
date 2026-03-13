import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyLineItems } from "@/lib/classifier";

export const dynamic = "force-dynamic";

/**
 * POST /api/invoices/[id]/classify
 *
 * Re-runs the dedicated AI classification pass on all line items for the
 * given invoice, injecting the invoice concept and vendor name as context.
 * Updates the category (and confidence) on each line item in place.
 *
 * Returns the updated line items array.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fetch the invoice with its line items and extracted fields
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      vendor: true,
      lineItems: true,
      extractedData: {
        where: { fieldName: { in: ["concept", "description_summary", "vendor_name"] } },
      },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.lineItems.length === 0) {
    return NextResponse.json({ lineItems: [] });
  }

  // Gather context fields from extracted data
  const fieldMap: Record<string, string | null> = {};
  for (const f of invoice.extractedData) {
    fieldMap[f.fieldName] = f.value ?? null;
  }

  const concept    = fieldMap["concept"] ?? fieldMap["description_summary"] ?? null;
  const vendorName = invoice.vendor?.name ?? fieldMap["vendor_name"] ?? null;

  // Run the focused classifier
  const descriptions = invoice.lineItems.map((li) => li.description);
  const results = await classifyLineItems(descriptions, { concept, vendorName });

  // Persist updated categories
  await Promise.all(
    invoice.lineItems.map((li, i) => {
      const result = results[i];
      if (!result || result.category === null) return Promise.resolve();
      return prisma.lineItem.update({
        where: { id: li.id },
        data: {
          category:   result.category,
          confidence: result.confidence,
        },
      });
    })
  );

  // Log event
  await prisma.ingestionEvent.create({
    data: {
      invoiceId: id,
      eventType: "line_items_classified",
      metadata: JSON.stringify({
        itemCount:  invoice.lineItems.length,
        concept,
        vendorName,
        categories: results.map((r) => r.category),
      }),
    },
  });

  // Return updated line items
  const updated = await prisma.lineItem.findMany({ where: { invoiceId: id } });
  return NextResponse.json({
    lineItems: updated.map((li) => ({
      id:          li.id,
      description: li.description,
      quantity:    li.quantity,
      unitPrice:   li.unitPrice,
      lineTotal:   li.lineTotal,
      category:    li.category ?? null,
      confidence:  li.confidence,
    })),
  });
}

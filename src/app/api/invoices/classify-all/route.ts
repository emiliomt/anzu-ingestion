import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyLineItems } from "@/lib/classifier";
import { requireOrgId } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ClassifyResult {
  invoiceId: string;
  referenceNo: string;
  status: "ok" | "skipped" | "error";
  classifiedCount?: number;
  message?: string;
}

export async function POST(request: NextRequest) {
  try {
    const orgId = await requireOrgId();
    const orgScope = { OR: [{ organizationId: orgId }, { organizationId: null }] };
    const body = (await request.json().catch(() => ({}))) as {
      cursor?: string;
      batchSize?: number;
    };
    const batchSize = Math.min(
      Math.max(Number(body.batchSize ?? 8) || 8, 1),
      20
    );

    const fetched = await prisma.invoice.findMany({
      where: {
        ...orgScope,
        status: { in: ["extracted", "reviewed", "complete"] },
      },
      orderBy: { id: "asc" },
      ...(body.cursor
        ? { cursor: { id: body.cursor }, skip: 1 }
        : {}),
      take: batchSize + 1,
      include: {
        vendor: true,
        lineItems: true,
        extractedData: {
          where: { fieldName: { in: ["concept", "description_summary", "vendor_name"] } },
        },
      },
    });
    const invoices = fetched.slice(0, batchSize);
    const hasMore = fetched.length > batchSize;
    const nextCursor = hasMore ? invoices[invoices.length - 1]?.id ?? null : null;

    const results: ClassifyResult[] = [];

    for (const invoice of invoices) {
      if (invoice.lineItems.length === 0) {
        results.push({
          invoiceId: invoice.id,
          referenceNo: invoice.referenceNo,
          status: "skipped",
          message: "No line items found",
        });
        continue;
      }

      const descriptions = invoice.lineItems.map((li) => li.description);
      if (descriptions.every((d) => !(d ?? "").trim())) {
        results.push({
          invoiceId: invoice.id,
          referenceNo: invoice.referenceNo,
          status: "skipped",
          message: "No non-empty line-item descriptions",
        });
        continue;
      }

      const fieldMap: Record<string, string | null> = {};
      for (const f of invoice.extractedData) fieldMap[f.fieldName] = f.value ?? null;
      const concept = fieldMap["concept"] ?? fieldMap["description_summary"] ?? null;
      const vendorName = invoice.vendor?.name ?? fieldMap["vendor_name"] ?? null;

      try {
        const aiResults = await classifyLineItems(descriptions, { concept, vendorName });
        let classifiedCount = 0;

        await Promise.all(
          invoice.lineItems.map((li, idx) => {
            const r = aiResults[idx];
            if (!r || r.category === null) return Promise.resolve();
            classifiedCount += 1;
            return prisma.lineItem.update({
              where: { id: li.id },
              data: {
                category: r.category,
                confidence: r.confidence,
              },
            });
          })
        );

        if (classifiedCount === 0) {
          results.push({
            invoiceId: invoice.id,
            referenceNo: invoice.referenceNo,
            status: "skipped",
            message: "AI returned no valid categories",
          });
          continue;
        }

        await prisma.ingestionEvent.create({
          data: {
            invoiceId: invoice.id,
            eventType: "line_items_classified",
            metadata: JSON.stringify({
              mode: "bulk",
              itemCount: invoice.lineItems.length,
              classifiedCount,
              concept,
              vendorName,
              categories: aiResults.map((r) => r.category),
            }),
          },
        });

        results.push({
          invoiceId: invoice.id,
          referenceNo: invoice.referenceNo,
          status: "ok",
          classifiedCount,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Classification failed";
        results.push({
          invoiceId: invoice.id,
          referenceNo: invoice.referenceNo,
          status: "error",
          message,
        });
      }
    }

    return NextResponse.json({
      processed: results.length,
      classified: results.filter((r) => r.status === "ok").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
      hasMore,
      nextCursor,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unexpected classify-all error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Anzu Dynamics — RPA Job History API
// GET /api/jobs — returns recent RPA execution events for the current org.
// Powers the /automation dashboard page.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgId } from "@/lib/tenant";
import { RoleError } from "@/lib/roles";

export const dynamic = "force-dynamic";

const RPA_EVENT_TYPES = ["rpa_submitted", "rpa_failed"];
const DEFAULT_LIMIT = 50;

export async function GET(request: NextRequest) {
  try {
    const orgId = await requireOrgId();
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? DEFAULT_LIMIT), 200);
    const status = searchParams.get("status"); // "success" | "failed" | null (all)

    const eventTypes =
      status === "success"
        ? ["rpa_submitted"]
        : status === "failed"
        ? ["rpa_failed"]
        : RPA_EVENT_TYPES;

    const events = await prisma.ingestionEvent.findMany({
      where: {
        eventType: { in: eventTypes },
        invoice: { organizationId: orgId },
      },
      orderBy: { timestamp: "desc" },
      take: limit,
      include: {
        invoice: {
          select: {
            id: true,
            referenceNo: true,
            fileName: true,
            status: true,
            organizationId: true,
          },
        },
      },
    });

    const jobs = events.map((ev) => {
      let meta: Record<string, unknown> = {};
      try {
        meta = JSON.parse(ev.metadata ?? "{}") as Record<string, unknown>;
      } catch {
        // ignore malformed metadata
      }

      return {
        id: ev.id,
        invoiceId: ev.invoiceId,
        referenceNo: ev.invoice.referenceNo,
        fileName: ev.invoice.fileName,
        invoiceStatus: ev.invoice.status,
        eventType: ev.eventType,
        success: ev.eventType === "rpa_submitted",
        erpType: (meta.erpType as string) ?? null,
        erpReference: (meta.erpReference as string) ?? null,
        message: (meta.message as string) ?? null,
        action: (meta.action as string) ?? null,
        timestamp: ev.timestamp.toISOString(),
      };
    });

    return NextResponse.json({ jobs, total: jobs.length });
  } catch (err) {
    if (err instanceof RoleError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[jobs GET]", err);
    return NextResponse.json({ error: "Failed to load job history" }, { status: 500 });
  }
}

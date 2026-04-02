import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withPlanFeature } from "@/lib/plan-guard";

export const dynamic = "force-dynamic";

async function _POST(request: NextRequest) {
  const body = await request.json() as {
    matchId: string;
    confirmedBy?: string;
    reject?: boolean;
  };

  if (!body.matchId) {
    return NextResponse.json({ error: "matchId required" }, { status: 400 });
  }

  if (body.reject) {
    await prisma.invoiceMatch.delete({ where: { id: body.matchId } });
    return NextResponse.json({ ok: true, action: "rejected" });
  }

  const match = await prisma.invoiceMatch.update({
    where: { id: body.matchId },
    data: {
      isConfirmed: true,
      confirmedBy: body.confirmedBy ?? "admin",
      confirmedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, action: "confirmed", id: match.id });
}

export const POST = withPlanFeature("matching", _POST);

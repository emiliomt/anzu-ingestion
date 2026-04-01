/**
 * Proxy to anzu-security /api/v1/settings/{org_id}
 * Uses the server-side SECURITY_SERVICE_URL env var — no public URL needed.
 */
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SECURITY_URL = process.env.SECURITY_SERVICE_URL ?? "";
const SECURITY_API_KEY = process.env.SECURITY_API_KEY ?? "";

function securityHeaders() {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (SECURITY_API_KEY) h["X-Api-Key"] = SECURITY_API_KEY;
  return h;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { org_id: string } }
) {
  if (!SECURITY_URL) {
    return NextResponse.json({ connected: false }, { status: 503 });
  }
  try {
    const resp = await fetch(
      `${SECURITY_URL}/api/v1/settings/${params.org_id}`,
      { headers: securityHeaders(), cache: "no-store" }
    );
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json({ error: "Security service unreachable" }, { status: 502 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { org_id: string } }
) {
  if (!SECURITY_URL) {
    return NextResponse.json({ error: "SECURITY_SERVICE_URL not configured" }, { status: 503 });
  }
  try {
    const body = await req.json();
    const resp = await fetch(
      `${SECURITY_URL}/api/v1/settings/${params.org_id}`,
      { method: "PUT", headers: securityHeaders(), body: JSON.stringify(body) }
    );
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json({ error: "Security service unreachable" }, { status: 502 });
  }
}

/**
 * Proxy to anzu-security SAT endpoints.
 * GET  → /api/v1/sat/status
 * POST → /api/v1/sat/refresh
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

export async function GET() {
  if (!SECURITY_URL) {
    return NextResponse.json({ connected: false }, { status: 503 });
  }
  try {
    const resp = await fetch(`${SECURITY_URL}/api/v1/sat/status`, {
      headers: securityHeaders(), cache: "no-store",
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json({ error: "Security service unreachable" }, { status: 502 });
  }
}

export async function POST() {
  if (!SECURITY_URL) {
    return NextResponse.json({ error: "SECURITY_SERVICE_URL not configured" }, { status: 503 });
  }
  try {
    const resp = await fetch(`${SECURITY_URL}/api/v1/sat/refresh`, {
      method: "POST", headers: securityHeaders(),
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json({ error: "Security service unreachable" }, { status: 502 });
  }
}

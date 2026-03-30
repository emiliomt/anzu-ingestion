import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, cookieOptions } from "@/lib/auth";

export async function POST(request: NextRequest) {
  let body: { email?: string; code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const code = (body.code ?? "").trim();

  if (!email || !code) {
    return NextResponse.json({ error: "Email and code required" }, { status: 400 });
  }

  const record = await prisma.otpCode.findFirst({
    where: {
      email,
      code,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 401 });
  }

  // Mark code as used
  await prisma.otpCode.update({ where: { id: record.id }, data: { used: true } });

  const token = await signToken(email);
  const { name, ...rest } = cookieOptions(60 * 60 * 24 * 30);

  const response = NextResponse.json({ ok: true, email });
  response.cookies.set(name, token, rest);
  return response;
}

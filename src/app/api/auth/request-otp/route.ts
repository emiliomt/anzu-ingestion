import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOtpEmail } from "@/lib/auth";

export async function POST(request: NextRequest) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  // Auto-create user on first login (single-tenant admin tool)
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  // Invalidate any existing unused codes for this email
  await prisma.otpCode.updateMany({
    where: { email, used: false },
    data: { used: true },
  });

  // Generate a 6-digit code
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.otpCode.create({ data: { email, code, expiresAt } });

  await sendOtpEmail(email, code);

  return NextResponse.json({ ok: true });
}

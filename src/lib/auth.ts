import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import nodemailer from "nodemailer";

const COOKIE_NAME = "anzu_token";
const TOKEN_TTL = 60 * 60 * 24 * 30; // 30 days in seconds

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET env var is not set");
  return new TextEncoder().encode(secret);
}

export function isAuthDisabled(): boolean {
  return process.env.DISABLE_AUTH === "true";
}

export async function signToken(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL}s`)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { email: payload.email as string };
  } catch {
    return null;
  }
}

/** Read session from the request cookie (for middleware and API routes). */
export async function getSessionFromRequest(req: NextRequest): Promise<{ email: string } | null> {
  if (isAuthDisabled()) return { email: "system" };
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/** Read session from the server-side cookie store (for Server Components). */
export async function getSession(): Promise<{ email: string } | null> {
  if (isAuthDisabled()) return { email: "system" };
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function cookieOptions(maxAge: number) {
  return {
    name: COOKIE_NAME,
    maxAge,
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}

/** Send a 6-digit OTP to the given email address. */
export async function sendOtpEmail(email: string, code: string): Promise<void> {
  if (!process.env.SMTP_USER) {
    // Dev fallback: log the code so the developer can use it
    console.log(`[Auth] OTP for ${email}: ${code}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.mailtrap.io",
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS ?? "",
    },
  });

  const from =
    process.env.AUTH_EMAIL_FROM ??
    process.env.SMTP_FROM ??
    "AnzuIngestion <noreply@anzuingestion.com>";

  await transporter.sendMail({
    from,
    to: email,
    subject: `Your AnzuIngestion login code: ${code}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; padding: 40px 0;">
  <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="display: flex; align-items: center; margin-bottom: 32px;">
      <div style="width: 40px; height: 40px; background: #4f46e5; border-radius: 10px; margin-right: 12px;"></div>
      <h1 style="margin: 0; font-size: 20px; color: #1e1b4b;">AnzuIngestion</h1>
    </div>
    <h2 style="color: #111827; margin-bottom: 8px;">Your login code</h2>
    <p style="color: #6b7280; margin-bottom: 24px;">Enter this code to sign in. It expires in 10 minutes.</p>
    <div style="background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
      <span style="font-size: 36px; font-weight: 700; letter-spacing: 0.2em; color: #4f46e5;">${code}</span>
    </div>
    <p style="color: #9ca3af; font-size: 13px; margin: 0;">
      If you didn't request this code, you can safely ignore this email.
    </p>
  </div>
</body>
</html>
    `,
  });
}

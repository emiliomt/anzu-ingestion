import { NextResponse } from "next/server";
import { cookieOptions } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  const { name, ...rest } = cookieOptions(0);
  response.cookies.set(name, "", rest);
  return response;
}

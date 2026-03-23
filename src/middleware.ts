import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Paths that do NOT require authentication
const PUBLIC_PREFIXES = [
  "/portal",
  "/status",
  "/pricing",
  "/login",
  "/api/auth",
  "/api/upload",
  "/api/webhooks",
];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname === "/" ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!isPublic && !req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  // Run on all paths except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};

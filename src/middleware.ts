import { NextResponse, type NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";

// Routes that are always public (no auth required)
const PUBLIC_PAGE_PREFIXES = ["/", "/pricing", "/login", "/status"];
const PUBLIC_API_PREFIXES = ["/api/auth", "/api/webhooks", "/api/status"];

function isPublicPage(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PAGE_PREFIXES.some(
    (prefix) => prefix !== "/" && pathname.startsWith(prefix)
  );
}

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public pages and public API routes
  if (isPublicPage(pathname) || isPublicApi(pathname)) {
    return NextResponse.next();
  }

  // Static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  // Check auth
  const session = await getSessionFromRequest(request);
  if (session) return NextResponse.next();

  // Not authenticated
  if (isApiRoute(pathname)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Redirect pages to login
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on all routes except static assets handled by Next.js
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

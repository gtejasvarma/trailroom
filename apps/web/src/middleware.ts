import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, readGateConfig, verifyGateCookie } from "@/lib/gate";

// Everything is behind the shared password except the gate itself and /api/internal/*,
// which authenticates callers (Workflows, Scheduler) with OIDC in its own route handlers.
function isExempt(pathname: string): boolean {
  return (
    pathname === "/gate" ||
    pathname === "/api/gate" ||
    pathname === "/api/internal" ||
    pathname.startsWith("/api/internal/")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isExempt(pathname)) return NextResponse.next();

  const config = readGateConfig(process.env);
  const ok =
    config !== null &&
    (await verifyGateCookie(
      config.secret,
      config.password,
      request.cookies.get(GATE_COOKIE)?.value,
    ));
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "gate_required" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/gate";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Next's own static assets and the favicon never need the gate. The image optimizer is off
  // (next.config.ts), so _next/image is gated like any other path.
  matcher: ["/((?!_next/static|favicon.ico).*)"],
};

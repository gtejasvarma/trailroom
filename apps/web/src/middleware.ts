import { NextResponse, type NextRequest } from "next/server";
import {
  GATE_COOKIE,
  gateIsOff,
  readGateConfig,
  verifyGateCookie,
} from "@/lib/gate";
import {
  isExempt,
  isPublicAskPath,
  isPublicUnsubscribePath,
} from "@/lib/gate-paths";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // With the gate off the password page has nothing to ask, so it leads home.
  if (pathname === "/gate" && gateIsOff(process.env)) {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }
  if (isExempt(pathname)) {
    const res = NextResponse.next();
    if (isPublicAskPath(pathname) || isPublicUnsubscribePath(pathname)) {
      // The link is the secret: never indexed, cached or sent on as a referrer. (The routes set
      // the same headers themselves; this covers the page.)
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      res.headers.set("Cache-Control", "private, no-store");
      res.headers.set("Referrer-Policy", "no-referrer");
    }
    return res;
  }

  // The gate is switched off (GATE=off): everything is public.
  if (gateIsOff(process.env)) return NextResponse.next();

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

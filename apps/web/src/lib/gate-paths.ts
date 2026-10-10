// Which paths the password gate lets through. Pure, so the boundary is unit tested.

// The public vote page: friends open an ask link with no password and no account. Exactly the page
// /ask/<token> and its three API routes, and nothing else: no /ask, /asks, /api/asks, no
// /api/ask-anything, no trailing or doubled slashes. A token segment is anything but a slash
// (route handlers validate its shape), and "." / ".." are refused as segments.
const ASK_PAGE = /^\/ask\/([^/]+)$/;
const ASK_API = /^\/api\/ask\/([^/]+)(?:\/vote|\/image\/[^/]+)?$/;
const isDotSegment = (s: string | undefined) => s === "." || s === "..";

// The unsubscribe page and its one POST route, from the link in an email: the token is the proof.
// Exactly /unsubscribe/<token> and /api/unsubscribe/<token>, a single non-slash segment each, no
// dot segments, nothing else.
const UNSUB_PAGE = /^\/unsubscribe\/([^/]+)$/;
const UNSUB_API = /^\/api\/unsubscribe\/([^/]+)$/;

export function isPublicUnsubscribePath(pathname: string): boolean {
  const m = UNSUB_PAGE.exec(pathname) ?? UNSUB_API.exec(pathname);
  return m !== null && !isDotSegment(m[1]);
}

export function isPublicAskPath(pathname: string): boolean {
  const m = ASK_PAGE.exec(pathname) ?? ASK_API.exec(pathname);
  return m !== null && !isDotSegment(m[1]);
}

// Everything is behind the shared password except the gate itself, the public ask page and its
// API, the unsubscribe page and its API (above), and /api/internal/*, which authenticates callers (Workflows, Scheduler) with OIDC
// in its own route handlers.
export function isExempt(pathname: string): boolean {
  return (
    pathname === "/gate" ||
    pathname === "/api/gate" ||
    pathname === "/api/internal" ||
    pathname.startsWith("/api/internal/") ||
    isPublicAskPath(pathname) ||
    isPublicUnsubscribePath(pathname)
  );
}

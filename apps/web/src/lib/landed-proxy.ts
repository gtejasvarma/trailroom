// https://trailroom.ai/landed is Landed, a separate app (Firebase project landed-d2625) on its own App
// Hosting backend. App Hosting cannot route one path of a domain to another project, so Trailroom
// forwards /landed and everything under it. A next.config rewrite cannot do it: it passes the
// visitor's Host (trailroom.ai) on, and Google's front end refuses a request for one site that names
// another (401). So this makes a fresh request to Landed, with Landed's own host, and streams the
// answer back. Landed is built for the /landed prefix, so the path passes through unchanged.

export const LANDED_ORIGIN =
  "https://landed--landed-d2625.us-central1.hosted.app";

/**
 * The only request headers passed on to Landed. Everything else stays behind, in particular the
 * headers Google's hosting adds on the way into Trailroom (routing and identity headers meant for
 * Trailroom's own backend: forwarded to Landed's, they make its front end refuse the request with a
 * 401) and Trailroom's cookies.
 */
const ALLOW_REQUEST = new Set([
  "accept",
  "accept-language",
  "authorization", // Landed's Firebase sign-in token
  // The person's Google token for reading a deck they picked. Not `x-google-*`: Google's front end
  // strips headers with that prefix.
  "x-workspace-token",
  "content-type",
  "user-agent",
  "range",
  "if-none-match",
  "if-modified-since",
  "cache-control",
  "pragma",
  "origin",
  "referer",
  // Next.js client navigation
  "rsc",
  "next-url",
  "next-action",
  "next-router-state-tree",
  "next-router-prefetch",
  "next-router-segment-prefetch",
]);

/**
 * Where the middleware keeps the browser's `next-url` header for Landed. Trailroom's own Next server
 * deletes `next-url` before the route handler runs (Trailroom has no interception routes, so it has
 * no use for it). But the browser folded `next-url` into the `_rsc` value of a client navigation, and
 * Landed checks that value against the headers it receives: without `next-url` the check fails,
 * Landed redirects to a corrected `_rsc`, the browser asks again with the same headers, and the
 * navigation ends in ERR_TOO_MANY_REDIRECTS. So the middleware copies `next-url` here first, and the
 * proxy turns it back into `next-url`.
 */
export const LANDED_NEXT_URL_HEADER = "x-landed-next-url";

/**
 * Response headers that would be wrong once relayed: fetch has already undone the compression, and
 * Trailroom's server sets its own framing.
 */
const DROP_RESPONSE = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
]);

/** The address at Landed for a request that arrived at Trailroom (path and query unchanged). */
export function landedUrl(requestUrl: string): string {
  const u = new URL(requestUrl);
  return `${LANDED_ORIGIN}${u.pathname}${u.search}`;
}

export function requestHeadersForLanded(
  incoming: Headers,
  requestUrl: string,
): Headers {
  const out = new Headers();
  incoming.forEach((value, key) => {
    if (ALLOW_REQUEST.has(key.toLowerCase())) out.set(key, value);
  });
  const nextUrl = incoming.get(LANDED_NEXT_URL_HEADER);
  if (nextUrl) out.set("next-url", nextUrl);
  const u = new URL(requestUrl);
  out.set("x-forwarded-host", u.host);
  out.set("x-forwarded-proto", u.protocol.replace(":", ""));
  return out;
}

/**
 * Landed's answer, ready to relay. A redirect Landed makes names Landed's own address; it is pointed
 * back at the address the visitor used (trailroom.ai), so nobody is moved off it.
 */
export function responseHeadersFromLanded(
  upstream: Headers,
  requestUrl: string,
): Headers {
  const out = new Headers();
  const visitorOrigin = new URL(requestUrl).origin;
  upstream.forEach((value, key) => {
    const k = key.toLowerCase();
    if (DROP_RESPONSE.has(k)) return;
    if (k === "location" && value.startsWith(LANDED_ORIGIN))
      out.append(key, visitorOrigin + value.slice(LANDED_ORIGIN.length));
    else out.append(key, value);
  });
  return out;
}

/** Forwards one request to Landed and returns Landed's answer, streamed. */
export async function proxyToLanded(request: Request): Promise<Response> {
  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const init: RequestInit & { duplex?: "half" } = {
    method,
    headers: requestHeadersForLanded(request.headers, request.url),
    redirect: "manual",
    signal: request.signal,
  };
  if (hasBody) {
    init.body = request.body;
    init.duplex = "half";
  }
  try {
    const upstream = await fetch(landedUrl(request.url), init);
    if (upstream.status === 401 && upstream.headers.has("www-authenticate")) {
      // Landed's front end refused the request itself (Landed's own 401s carry no such header).
      // Log which headers arrived (names only, never values) to see what reached it.
      const names: string[] = [];
      request.headers.forEach((_v, k) => names.push(k));
      console.warn(
        `landed proxy: Landed's front end refused ${new URL(request.url).pathname}; incoming header names: ${names.sort().join(", ")}`,
      );
    }
    return new Response(method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeadersFromLanded(upstream.headers, request.url),
    });
  } catch {
    return new Response("Landed could not be reached. Try again in a moment.", {
      status: 502,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
}

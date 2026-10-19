// https://trailroom.ai/landed is Landed, a separate app (Firebase project landed-d2625) on its own App
// Hosting backend. App Hosting cannot route one path of a domain to another project, so Trailroom
// forwards /landed and everything under it. A next.config rewrite cannot do it: it passes the
// visitor's Host (trailroom.ai) on, and Google's front end refuses a request for one site that names
// another (401). So this makes a fresh request to Landed, with Landed's own host, and streams the
// answer back. Landed is built for the /landed prefix, so the path passes through unchanged.

export const LANDED_ORIGIN =
  "https://landed--landed-d2625.us-central1.hosted.app";

/** Request headers that describe the connection to Trailroom, not the request for Landed. */
const DROP_REQUEST = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-connection",
  "transfer-encoding",
  "te",
  "trailer",
  "upgrade",
  "content-length",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-for",
  "x-forwarded-port",
  "cookie",
]);

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
    if (!DROP_REQUEST.has(key.toLowerCase())) out.set(key, value);
  });
  const u = new URL(requestUrl);
  out.set("x-forwarded-host", u.host);
  out.set("x-forwarded-proto", u.protocol.replace(":", ""));
  return out;
}

export function responseHeadersFromLanded(upstream: Headers): Headers {
  const out = new Headers();
  upstream.forEach((value, key) => {
    if (!DROP_RESPONSE.has(key.toLowerCase())) out.append(key, value);
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
    return new Response(method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeadersFromLanded(upstream.headers),
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

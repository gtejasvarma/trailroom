// Verifies Google-signed OIDC ID tokens from service callers (Cloud Workflows, Cloud Scheduler)
// on /api/internal/*. Fails closed: a missing audience, an empty allow-list, a missing or
// malformed token, or any verification error is a 401. There is no bypass flag in any
// environment; tests inject a key source instead (useKeySourceForTests).
import { OAuth2Client } from "google-auth-library";

type CertFormat = Awaited<
  ReturnType<OAuth2Client["getFederatedSignonCertsAsync"]>
>["format"];

const ISSUER = "https://accounts.google.com";

/** PEM public keys by key id, as Google's JWKS endpoint serves them (after conversion). */
export type KeySource = () => Promise<Record<string, string>>;

export interface ServiceCallerOptions {
  /** The expected `aud` claim: the app's public base URL. Undefined or empty fails closed. */
  audience: string | undefined;
  /** Service account emails that may call. Undefined or empty entries are ignored. */
  allowedEmails: ReadonlyArray<string | undefined>;
  keySource?: KeySource;
}

let testKeySource: KeySource | null = null;

/** Tests only. Refused under NODE_ENV=production, so it can never widen trust in a deploy. */
export function useKeySourceForTests(source: KeySource | null): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("useKeySourceForTests is not available in production");
  }
  testKeySource = source;
}

function clientFor(source: KeySource | null): OAuth2Client {
  const client = new OAuth2Client({ issuers: [ISSUER] });
  if (source) {
    client.getFederatedSignonCertsAsync = async () => ({
      certs: await source(),
      format: "PEM" as CertFormat,
    });
  }
  return client;
}

// One client for Google's real keys, so the library's cert cache is reused across requests.
let defaultClient: OAuth2Client | undefined;

const unauthorized = () =>
  Response.json(
    { error: "unauthorized" },
    { status: 401, headers: { "Cache-Control": "private, no-store" } },
  );

function decodeHeader(token: string): { alg?: unknown } | null {
  try {
    return JSON.parse(
      Buffer.from(token.split(".")[0] ?? "", "base64url").toString("utf8"),
    );
  } catch {
    return null;
  }
}

/** The verified caller's email, or a 401 Response. */
export async function requireServiceCaller(
  request: Request,
  options: ServiceCallerOptions,
): Promise<{ email: string } | Response> {
  const audience = options.audience?.trim();
  const allowed = options.allowedEmails
    .filter((e): e is string => typeof e === "string" && e.trim() !== "")
    .map((e) => e.trim().toLowerCase());
  if (!audience || allowed.length === 0) return unauthorized();

  const header = request.headers.get("authorization");
  const match = header ? /^Bearer ([^\s]+)$/.exec(header.trim()) : null;
  if (!match) return unauthorized();
  const idToken = match[1]!;
  if (decodeHeader(idToken)?.alg !== "RS256") return unauthorized();

  try {
    const source = options.keySource ?? testKeySource;
    const client = source
      ? clientFor(source)
      : (defaultClient ??= clientFor(null));
    const ticket = await client.verifyIdToken({ idToken, audience });
    const p = ticket.getPayload();
    if (!p || p.iss !== ISSUER) return unauthorized();
    if (p.email_verified !== true) return unauthorized();
    const email = typeof p.email === "string" ? p.email.toLowerCase() : "";
    if (!email || !allowed.includes(email)) return unauthorized();
    return { email };
  } catch {
    return unauthorized();
  }
}

/** Env-driven config for the two kinds of internal caller. */
export function requireWorkflowsCaller(request: Request) {
  return requireServiceCaller(request, {
    audience: process.env.INTERNAL_AUDIENCE,
    allowedEmails: [process.env.WORKFLOWS_SA_EMAIL],
  });
}

export function requireSchedulerCaller(request: Request) {
  return requireServiceCaller(request, {
    audience: process.env.INTERNAL_AUDIENCE,
    allowedEmails: [process.env.SCHEDULER_SA_EMAIL],
  });
}

// Password gate primitives. Pure and Edge-safe: Web Crypto only, no node:crypto, so the
// middleware can import this file directly.

export const GATE_COOKIE = "trailroom_gate";
export const GATE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface GateConfig {
  password: string;
  secret: string;
}

// Fails closed: with either value missing there is no config, and callers must refuse
// everything. This applies outside production too, so a misconfigured dev box never silently
// runs an open gate that then gets copied into a deploy.
export function readGateConfig(
  env: Record<string, string | undefined>,
): GateConfig | null {
  const { GATE_PASSWORD: password, GATE_COOKIE_SECRET: secret } = env;
  if (!password || !secret) return null;
  // A cookie secret equal to the password would let anyone who knows the password forge cookies
  // for any expiry. Fail closed.
  if (password === secret) return null;
  return { password, secret };
}

const encoder = new TextEncoder();

async function sha256(input: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(input)),
  );
}

// Constant-time string comparison. Both inputs are hashed first, so the compared buffers
// are always 32 bytes: equal-length and unequal-length inputs take the same path and a
// length difference leaks nothing. The loop never exits early.
export async function constantTimeEqual(
  a: string,
  b: string,
): Promise<boolean> {
  const [da, db] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < da.length; i++) diff |= da[i] ^ db[i];
  return diff === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(message)),
  );
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  return Array.from(await sha256(input), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

// The signed message is "<expiry>.<sha256 hex of the password>", so changing GATE_PASSWORD
// invalidates every existing cookie. The password hash is never in the cookie value.
const messageFor = async (expiry: string, password: string) =>
  `${expiry}.${await sha256Hex(password)}`;

// Cookie value: "<expiry unix seconds>.<hmac hex>". The expiry is inside the signed payload, so
// it cannot be extended without the secret.
export async function signGateCookie(
  secret: string,
  password: string,
  nowMs: number = Date.now(),
): Promise<string> {
  const expiry = String(Math.floor(nowMs / 1000) + GATE_MAX_AGE_SECONDS);
  return `${expiry}.${await hmacHex(secret, await messageFor(expiry, password))}`;
}

export async function verifyGateCookie(
  secret: string,
  password: string,
  value: string | undefined,
  nowMs: number = Date.now(),
): Promise<boolean> {
  if (!value) return false;
  const dot = value.indexOf(".");
  if (dot < 1) return false;
  const expiryStr = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!/^\d+$/.test(expiryStr)) return false;
  // Always compute and compare the signature before looking at expiry.
  const sigOk = await constantTimeEqual(
    await hmacHex(secret, await messageFor(expiryStr, password)),
    sig,
  );
  return sigOk && Number(expiryStr) > Math.floor(nowMs / 1000);
}

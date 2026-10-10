// The ask link token: 256 random bits, URL-safe (base64url, 43 characters, no padding). Only its
// SHA-256 hash is stored, so a read of the database never yields a working link.
import { createHash, randomBytes } from "node:crypto";

export const ASK_TOKEN_BYTES = 32;
export const ASK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function newAskToken(): { token: string; hash: string } {
  const token = randomBytes(ASK_TOKEN_BYTES).toString("base64url");
  return { token, hash: hashAskToken(token) };
}

export const hashAskToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

/** Cheap shape check, so garbage never reaches the database. */
export const isAskTokenShape = (token: unknown): token is string =>
  typeof token === "string" && ASK_TOKEN_PATTERN.test(token);

/**
 * A voter key for someone with no account: 128 random bits as 32 hex characters. Hex, so it is
 * always a valid document id, and never the shape of a Firebase uid (28 characters).
 */
export const newVoterKey = (): string => randomBytes(16).toString("hex");
export const VOTER_KEY_PATTERN = /^[a-f0-9]{32}$/;

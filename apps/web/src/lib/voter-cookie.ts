// The anonymous voter's id: a random key in an HttpOnly cookie. It is the document id under
// asks/{askId}/votes, which is what makes it one vote per voter. Scoped to /api/ask, the only
// place it is read. Pure, so it is unit tested.
import { VOTER_KEY_PATTERN } from "@trailroom/db";

export const VOTER_COOKIE = "trailroom_voter";
export const VOTER_COOKIE_PATH = "/api/ask";
export const VOTER_COOKIE_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

/** The voter key from a Cookie header, or null when absent or not the shape we issue. */
export function readVoterKey(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== VOTER_COOKIE) continue;
    const value = part.slice(eq + 1).trim();
    return VOTER_KEY_PATTERN.test(value) ? value : null;
  }
  return null;
}

export function voterCookie(key: string, secure: boolean): string {
  return [
    `${VOTER_COOKIE}=${key}`,
    `Path=${VOTER_COOKIE_PATH}`,
    `Max-Age=${VOTER_COOKIE_MAX_AGE_SECONDS}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

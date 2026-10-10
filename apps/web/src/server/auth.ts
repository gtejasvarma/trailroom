// ID-token verification. The browser signs in with Firebase Auth (anonymous = Guest Session) and
// sends `Authorization: Bearer <ID token>` on every /api call.
import { auth } from "@trailroom/db";
import { errorResponse } from "./http";

export interface User {
  uid: string;
  isGuest: boolean;
}

/** The verified caller, or a 401 Response. */
export async function requireUser(request: Request): Promise<User | Response> {
  const header = request.headers.get("authorization");
  const match = header ? /^Bearer ([^\s]+)$/i.exec(header.trim()) : null;
  if (!match) return errorResponse("unauthorized");
  try {
    // checkRevoked: a deleted or revoked user's still-unexpired token is refused.
    const token = await auth().verifyIdToken(match[1]!, true);
    return {
      uid: token.uid,
      isGuest: token.firebase?.sign_in_provider === "anonymous",
    };
  } catch {
    return errorResponse("unauthorized");
  }
}

/**
 * The uid of a valid, unexpired ANONYMOUS ID token, or null. Used by the account merge, where
 * presenting the guest's token alongside the account's is the proof both belong to one person.
 */
export async function verifyGuestToken(token: string): Promise<string | null> {
  try {
    const t = await auth().verifyIdToken(token, true);
    return t.firebase?.sign_in_provider === "anonymous" ? t.uid : null;
  } catch {
    return null;
  }
}

/**
 * The verified caller if a valid bearer token is present, else null. Never a 401: the public ask
 * routes work without an account, and a bad token is treated as no token.
 */
export async function optionalUser(request: Request): Promise<User | null> {
  if (!request.headers.get("authorization")) return null;
  const u = await requireUser(request);
  return u instanceof Response ? null : u;
}

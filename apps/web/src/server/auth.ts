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
    const token = await auth().verifyIdToken(match[1]!);
    return {
      uid: token.uid,
      isGuest: token.firebase?.sign_in_provider === "anonymous",
    };
  } catch {
    return errorResponse("unauthorized");
  }
}

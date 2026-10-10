import {
  auth,
  deleteAllForUser,
  mergeGuestInto,
  promoteGuest,
  type MergeResult,
} from "@trailroom/db";
import { verifyGuestToken, type User } from "./auth";
import { err, ok, type Result } from "./http";

/** The UI calls this after an anonymous user links a real provider (with a refreshed token). */
export async function attachAccount(
  user: User,
): Promise<Result<{ isGuest: false }>> {
  if (user.isGuest) return err("still_guest");
  await promoteGuest(user.uid);
  return ok({ isGuest: false as const });
}

export async function deleteMyData(
  user: User,
): Promise<Result<{ deleted: true }>> {
  await deleteAllForUser(user.uid);
  // The sign-in goes too, so the person comes back as a new visitor. Already gone is fine.
  try {
    await auth().deleteUser(user.uid);
  } catch (e) {
    if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
  }
  return ok({ deleted: true as const });
}

/**
 * The person signed into a Google account that already existed, so the guest session they just
 * left cannot be linked. The caller (a real account) presents the guest's ID token as well;
 * holding both is the authorisation to move the guest's try-ons into the account.
 */
export async function mergeAccount(
  user: User,
  body: unknown,
): Promise<Result<MergeResult>> {
  if (user.isGuest) return err("merge_refused");
  const token = (body as { guestToken?: unknown } | undefined)?.guestToken;
  if (typeof token !== "string" || token.length === 0)
    return err("invalid_request");
  const guestUid = await verifyGuestToken(token);
  if (!guestUid || guestUid === user.uid) return err("merge_refused");
  return ok(await mergeGuestInto(guestUid, user.uid));
}

import { deleteAllForUser, promoteGuest } from "@trailroom/db";
import { err, ok, type Result } from "./http";
import type { User } from "./auth";

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
  return ok({ deleted: true as const });
}

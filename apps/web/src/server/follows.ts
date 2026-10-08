import { getLabel } from "@trailroom/catalog";
import { setFollow } from "@trailroom/db";
import { err, ok, type Result } from "./http";
import type { User } from "./auth";

/** Follow or unfollow a label. Idempotent; guests and accounts alike. */
export async function changeFollow(
  user: User,
  labelSlug: string,
  follow: boolean,
): Promise<Result<{ follows: string[] }>> {
  if (!getLabel(labelSlug)) return err("unknown_label");
  return ok({ follows: await setFollow(user.uid, labelSlug, follow) });
}

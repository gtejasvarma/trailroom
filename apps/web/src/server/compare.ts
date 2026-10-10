// The data behind Compare: the caller's own finished pose sets, by id. A guest has no full renders
// to compare (403 account_required); an id that is not the caller's, or not finished, is 404 for
// the whole request, so ids cannot be probed.
import { getPoseSet, kindOf } from "@trailroom/db";
import { POSES } from "@trailroom/render";
import {
  MAX_COMPARE,
  parseCompareIds,
  tooManyCompareIds,
} from "../lib/compare-ids";
import { err, ok, type Result } from "./http";
import type { TryOnSummary } from "./try-ons";
import type { User } from "./auth";

export async function getCompare(
  user: User,
  rawIds: string | null,
): Promise<Result<{ pieces: TryOnSummary[] }>> {
  if (user.isGuest) return err("account_required");
  if (tooManyCompareIds(rawIds)) return err("invalid_request");
  const ids = parseCompareIds(rawIds);
  if (ids.length === 0 || ids.length > MAX_COMPARE)
    return err("invalid_request");
  const pieces: TryOnSummary[] = [];
  for (const id of ids) {
    let set;
    try {
      set = await getPoseSet(id);
    } catch {
      return err("not_found");
    }
    if (
      !set ||
      set.uid !== user.uid ||
      kindOf(set) !== "tryon" ||
      (set.status !== "complete" && set.status !== "complete_partial") ||
      set.poses.length === 0
    )
      return err("not_found");
    pieces.push({
      poseSetId: id,
      jobId: set.jobId,
      itemId: set.itemId,
      photoId: set.photoId,
      status: set.status,
      poses: Object.keys(POSES).filter((p) => set.poses.includes(p)),
      createdAt: set.createdAt.toDate().toISOString(),
    });
  }
  return ok({ pieces });
}

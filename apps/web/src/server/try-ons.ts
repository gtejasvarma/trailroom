import { listPoseSetsForUser, removeTryOn } from "@trailroom/db";
import { POSES } from "@trailroom/render";
import { err, ok, type Result } from "./http";
import type { User } from "./auth";

export interface TryOnSummary {
  poseSetId: string;
  jobId: string;
  itemId: string;
  status: "complete" | "complete_partial";
  /** Published poses, in the fixed pose order. */
  poses: string[];
  createdAt: string;
}

/** GET /api/try-ons: the caller's finished pose sets, newest first. Nobody else's. */
export async function listTryOns(
  user: User,
): Promise<Result<{ tryOns: TryOnSummary[] }>> {
  const sets = await listPoseSetsForUser(user.uid);
  return ok({
    tryOns: sets
      .filter(
        (s) =>
          s.poseSet.uid === user.uid &&
          (s.poseSet.status === "complete" ||
            s.poseSet.status === "complete_partial") &&
          s.poseSet.poses.length > 0,
      )
      .reverse()
      .map((s) => ({
        poseSetId: s.id,
        jobId: s.poseSet.jobId,
        itemId: s.poseSet.itemId,
        status: s.poseSet.status as "complete" | "complete_partial",
        poses: Object.keys(POSES).filter((p) => s.poseSet.poses.includes(p)),
        createdAt: s.poseSet.createdAt.toDate().toISOString(),
      })),
  });
}

/** DELETE /api/try-ons/{poseSetId}: the visible discard. Only the caller's own finished try-on. */
export async function removeMyTryOn(
  user: User,
  poseSetId: string,
): Promise<Result<{ removed: true }>> {
  if (user.isGuest) return err("account_required");
  const r = await removeTryOn(user.uid, poseSetId);
  if (r === "not_found") return err("not_found");
  if (r === "rendering") return err("tryon_rendering");
  return ok({ removed: true as const });
}

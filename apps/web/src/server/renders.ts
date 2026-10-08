// The image proxy. It reads only through getRender (the published-renders prefix); no other
// stored object can be reached from here.
import { getPoseSet, getRender } from "@trailroom/db";
import { err, ok, type Result } from "./http";
import type { User } from "./auth";

export async function getRenderForUser(
  user: User,
  poseSetId: string,
  pose: string,
): Promise<Result<{ bytes: Buffer; contentType: string }>> {
  try {
    const set = await getPoseSet(poseSetId);
    if (
      !set ||
      set.uid !== user.uid ||
      set.status === "failed" ||
      !set.poses.includes(pose)
    ) {
      return err("not_found");
    }
    const obj = await getRender(user.uid, poseSetId, pose);
    if (!obj) return err("not_found");
    return ok({ bytes: obj.data, contentType: "image/jpeg" });
  } catch {
    return err("not_found"); // invalid path segments
  }
}

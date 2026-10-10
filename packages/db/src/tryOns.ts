// Removing a try-on: the visible discard. The pose set, its renders and its job go; the daily
// counters (usage/*) are deliberately left alone, so removing cannot reset a limit.
import { getPoseSet, deletePoseSet } from "./poseSets";
import { deleteJob } from "./jobs";
import { deleteRendersForPoseSet, deleteStagingForJob } from "./storage";

export type RemoveTryOnResult = "removed" | "not_found" | "rendering";

/** Removes the person's own finished try-on. Anyone else's id, or a missing one, is "not_found". */
export async function removeTryOn(
  uid: string,
  poseSetId: string,
): Promise<RemoveTryOnResult> {
  let set;
  try {
    set = await getPoseSet(poseSetId);
  } catch {
    return "not_found";
  }
  if (!set || set.uid !== uid) return "not_found";
  if (set.status === "rendering") return "rendering";
  await deleteRendersForPoseSet(uid, poseSetId);
  await deleteStagingForJob(set.jobId);
  await deleteJob(set.jobId);
  await deletePoseSet(poseSetId);
  // Catch a render that was published while this ran.
  await deleteRendersForPoseSet(uid, poseSetId);
  return "removed";
}

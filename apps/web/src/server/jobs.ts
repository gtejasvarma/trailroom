import { getJob, kindOf, type JobDoc } from "@trailroom/db";
import { closestThree } from "@trailroom/catalog";
import { err, ok, type Result } from "./http";
import type { User } from "./auth";

/** Client-safe shape of GET /api/jobs/[jobId]. */
export interface JobBody {
  jobId: string;
  poseSetId: string;
  itemId: string;
  /** "outfit" for two pieces rendered together; both ids in itemIds (itemId is the first). */
  kind: "tryon" | "outfit";
  itemIds: string[];
  photoId: string;
  /** Always true: the UI shows a visible AI caption next to (not on) each image. */
  aiGenerated: true;
  status: JobDoc["status"];
  failure: { code: string } | null;
  poseOrder: string[];
  poses: Record<string, { status: string; attempt: number; reasons: string[] }>;
  qaSkipped: string[];
  /** Three alternative item ids, present when the job failed. */
  closest?: string[];
  createdAt: string;
  updatedAt: string;
}

export async function getJobForUser(
  user: User,
  jobId: string,
): Promise<Result<JobBody>> {
  let job: JobDoc | null;
  try {
    job = await getJob(jobId);
  } catch {
    return err("not_found"); // a malformed id is just an id that is not there
  }
  // 404 for someone else's job, never 403, so ids cannot be probed.
  if (!job || job.uid !== user.uid) return err("not_found");
  return ok({
    jobId,
    poseSetId: job.poseSetId,
    itemId: job.itemId,
    kind: kindOf(job),
    itemIds: job.itemIds ?? [job.itemId],
    photoId: job.photoId,
    aiGenerated: true as const,
    status: job.status,
    // The internal detail string is not exposed.
    failure: job.failure ? { code: job.failure.code } : null,
    poseOrder: job.poseOrder,
    poses: Object.fromEntries(
      Object.entries(job.poses).map(([p, s]) => [
        p,
        { status: s.status, attempt: s.attempt, reasons: s.reasons },
      ]),
    ),
    qaSkipped: job.qaSkipped,
    ...(job.status === "failed"
      ? { closest: closestThree(job.itemId).map((i) => i.id) }
      : {}),
    createdAt: job.createdAt.toDate().toISOString(),
    updatedAt: job.updatedAt.toDate().toISOString(),
  });
}

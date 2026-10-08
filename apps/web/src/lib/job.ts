// What the screens need from a job, whether it came from Firestore or from GET /api/jobs/[id].
// Pure: no React, no Firebase, so it can be table-tested.
import { copy } from "./copy";

export type JobStatus =
  "queued" | "rendering" | "complete" | "complete_partial" | "failed";

export interface JobView {
  jobId: string;
  poseSetId: string;
  itemId: string;
  status: JobStatus;
  failure: { code: string } | null;
  poseOrder: string[];
  poses: Record<string, { status: string }>;
  qaSkipped: string[];
}

export const isFinished = (s: JobStatus) =>
  s === "complete" || s === "complete_partial";

export const passedPoses = (job: JobView): string[] =>
  job.poseOrder.filter((p) => job.poses[p]?.status === "passed");

/** One honest line, built only from the job's real state. */
export function statusLine(job: JobView): string {
  const total = job.poseOrder.length;
  const passed = passedPoses(job).length;
  switch (job.status) {
    case "queued":
      return copy.status.queued;
    case "rendering":
      return copy.status.rendering(passed, total);
    case "complete":
    case "complete_partial":
      return copy.status.ready(passed, total);
    case "failed":
      return copy.status.failed;
  }
}

/** Maps the JSON from GET /api/jobs/[id] or a Firestore job document to a JobView. */
export function toJobView(
  jobId: string,
  d: Record<string, unknown>,
): JobView | null {
  if (typeof d.status !== "string" || !Array.isArray(d.poseOrder)) return null;
  return {
    jobId,
    poseSetId: String(d.poseSetId ?? ""),
    itemId: String(d.itemId ?? ""),
    status: d.status as JobStatus,
    failure:
      d.failure && typeof d.failure === "object"
        ? { code: String((d.failure as { code?: unknown }).code ?? "internal") }
        : null,
    poseOrder: d.poseOrder.map(String),
    poses: Object.fromEntries(
      Object.entries(
        (d.poses ?? {}) as Record<string, { status?: unknown }>,
      ).map(([k, v]) => [k, { status: String(v?.status ?? "pending") }]),
    ),
    qaSkipped: Array.isArray(d.qaSkipped) ? d.qaSkipped.map(String) : [],
  };
}

// What the screens need from a job, whether it came from Firestore or from GET /api/jobs/[id].
// Pure: no React, no Firebase, so it can be table-tested.
import { copy } from "./copy";

export type JobStatus =
  "queued" | "rendering" | "complete" | "complete_partial" | "failed";

export interface JobView {
  jobId: string;
  poseSetId: string;
  itemId: string;
  /** "outfit": two pieces rendered together as one Front image (itemIds, canonical order). */
  kind: "tryon" | "outfit";
  itemIds: string[];
  /** The photo the render was made from; absent on a document that does not say. */
  photoId: string | null;
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
  if (job.kind === "outfit") {
    return job.status === "failed"
      ? copy.status.outfitFailed
      : isFinished(job.status)
        ? copy.status.outfitReady
        : copy.status.outfitRendering;
  }
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
    kind: d.kind === "outfit" ? "outfit" : "tryon",
    itemIds: Array.isArray(d.itemIds)
      ? d.itemIds.map(String)
      : [String(d.itemId ?? "")],
    photoId: typeof d.photoId === "string" ? d.photoId : null,
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

export const isRunning = (s: JobStatus) => s === "queued" || s === "rendering";

/** The chip's two lines, from the job's real state: a true count, never a "pose N of 4" sequence. */
export function chipLines(
  job: JobView,
  itemName: string,
  /** The second piece's name, for an outfit. */
  secondName = "",
): { title: string; sub: string } {
  if (job.kind === "outfit") {
    return {
      title: copy.chip.outfitRunning(itemName, secondName),
      sub: copy.chip.outfitSub,
    };
  }
  return {
    title: copy.chip.running(itemName),
    sub: copy.chip.sub(passedPoses(job).length, job.poseOrder.length),
  };
}

/** Queue screen title and line for the job's current state. */
export function queueLines(
  job: JobView,
  itemName: string,
  signedIn: boolean,
): { title: string; line: string } {
  const total = job.poseOrder.length;
  const n = passedPoses(job).length;
  if (!isFinished(job.status)) {
    return {
      title: copy.queue.titleRunning(total),
      line: copy.queue.lineRunning(itemName, total, n),
    };
  }
  return signedIn
    ? {
        title: copy.queue.titleReadySignedIn(n),
        line: copy.queue.lineReadySignedIn(itemName, n),
      }
    : {
        title: copy.queue.titleReadyGuest(n),
        line: copy.queue.lineReadyGuest(itemName, n),
      };
}

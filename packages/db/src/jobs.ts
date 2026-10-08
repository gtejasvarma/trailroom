import { FieldPath, Timestamp } from "firebase-admin/firestore";
import { firestore } from "./app";
import { assertSegment } from "./paths";
import { deleteJobInternal, setJobInternal } from "./jobInternals";
import {
  expiryFor,
  type AttemptRecord,
  type FailureCode,
  type JobDoc,
  type PoseState,
} from "./types";

const jobs = () => firestore().collection("jobs");

export type NewJob = Omit<
  JobDoc,
  "createdAt" | "updatedAt" | "expiresAt" | "status" | "failure"
> &
  Partial<Pick<JobDoc, "status" | "failure">>;

/** Creates jobs/{auto id}; returns the id and doc. Guest jobs expire 48h after creation. */
export async function createJob(
  input: NewJob,
  now: Date = new Date(),
): Promise<{ id: string; job: JobDoc }> {
  const ref = jobs().doc();
  const job: JobDoc = {
    ...input,
    status: input.status ?? "queued",
    failure: input.failure ?? null,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
    expiresAt: expiryFor(input.isGuest, now),
  };
  await ref.create(job);
  return { id: ref.id, job };
}

export async function getJob(jobId: string): Promise<JobDoc | null> {
  const snap = await jobs().doc(assertSegment("jobId", jobId)).get();
  return snap.exists ? (snap.data() as JobDoc) : null;
}

export type JobPatch = Partial<
  Pick<JobDoc, "status" | "qaSkipped" | "poseOrder" | "poses">
> & {
  /** `detail` is written to jobInternals; the job doc keeps only the code. */
  failure?: null | { code: FailureCode; detail?: string };
};

export async function updateJob(jobId: string, patch: JobPatch): Promise<void> {
  const { failure, ...rest } = patch;
  const data: Record<string, unknown> = { ...rest, updatedAt: Timestamp.now() };
  if (failure !== undefined) {
    data.failure = failure === null ? null : { code: failure.code };
    if (failure?.detail) {
      await setJobInternal(jobId, { failureDetail: failure.detail });
    }
  }
  await jobs().doc(assertSegment("jobId", jobId)).update(data);
}

/**
 * Updates one pose with field paths (poses.<pose>.<field>) so parallel updates to different
 * poses never overwrite each other.
 */
export async function setPoseState(
  jobId: string,
  pose: string,
  patch: Partial<PoseState>,
): Promise<void> {
  assertSegment("pose", pose);
  const args: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    args.push(new FieldPath("poses", pose, k), v);
  }
  args.push("updatedAt", Timestamp.now());
  const [first, second, ...rest] = args;
  await jobs()
    .doc(assertSegment("jobId", jobId))
    .update(first as FieldPath, second, ...rest);
}

/** Merges fields into poses.<pose>.attempts.<attempt> without touching other attempts. */
export async function setAttemptRecord(
  jobId: string,
  pose: string,
  attempt: number,
  patch: Partial<AttemptRecord> & { detail?: string },
): Promise<void> {
  assertSegment("pose", pose);
  const { detail, ...recorded } = patch;
  // Free text (model refusal text, error messages) is server-only.
  if (detail)
    await setJobInternal(jobId, { attemptDetail: { pose, attempt, detail } });
  const args: unknown[] = [];
  for (const [k, v] of Object.entries(recorded)) {
    if (v === undefined) continue;
    args.push(new FieldPath("poses", pose, "attempts", String(attempt), k), v);
  }
  args.push("updatedAt", Timestamp.now());
  const [first, second, ...rest] = args;
  await jobs()
    .doc(assertSegment("jobId", jobId))
    .update(first as FieldPath, second, ...rest);
}

/** Guest jobs whose expiresAt is at or before `now`. */
export async function listExpiredGuestJobs(
  now: Date = new Date(),
): Promise<{ id: string; job: JobDoc }[]> {
  const snap = await jobs()
    .where("isGuest", "==", true)
    .where("expiresAt", "<=", Timestamp.fromDate(now))
    .get();
  return snap.docs.map((d) => ({ id: d.id, job: d.data() as JobDoc }));
}

/** Jobs still queued/rendering whose last update is at or before `cutoff`. */
export async function listStaleJobs(
  cutoff: Date,
  limit = 100,
): Promise<{ id: string; job: JobDoc }[]> {
  const snap = await jobs()
    .where("status", "in", ["queued", "rendering"])
    .where("updatedAt", "<=", Timestamp.fromDate(cutoff))
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, job: d.data() as JobDoc }));
}

export async function deleteJob(jobId: string): Promise<void> {
  await jobs().doc(assertSegment("jobId", jobId)).delete();
  await deleteJobInternal(jobId);
}

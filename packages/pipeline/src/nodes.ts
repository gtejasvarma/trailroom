// The pipeline nodes. Each is a self-contained, idempotent async function with a small
// JSON-serialisable input and output, so Phase 5 can expose it as an HTTP endpoint. State lives
// in Firestore/Storage only; nothing is held in memory between calls.
import { getItem } from "@trailroom/catalog";
import {
  addPoseToSet,
  deleteRender,
  deleteRendersForPoseSet,
  deleteStagingForJob,
  FirestoreDailyLedger,
  getJob,
  getPhotoBytes,
  getPoseSet,
  getStaging,
  kindOf,
  publishRender,
  putStaging,
  setAttemptRecord,
  setPoseState,
  updateJob,
  updatePoseSet,
  type AttemptRecord,
  type JobDoc,
} from "@trailroom/db";
import {
  buildOutfitPrompt,
  buildPrompt,
  GENERIC_WEARING,
  renderConfigFromEnv,
  renderImage,
  ReservationExistsError,
  SpendCeilingError,
  type Category,
  type InputImage,
  type Pose,
} from "@trailroom/render";
import sharp from "sharp";
import { loadItemImage } from "./catalog-images";
import { JobTerminalError, RetryableNodeError } from "./errors";
import {
  failureCodeForFailedSet,
  MAX_ATTEMPTS,
  nextStepForPose,
  routeSet,
} from "./policy";
import { checkImage, SKIPPED_CHECKS } from "./qa";
import type {
  FailJobInput,
  FailJobOutput,
  FailPoseInput,
  FailPoseOutput,
  FinalizeSetOutput,
  PoseAttemptInput,
  PrepareInput,
  PrepareOutput,
  PublishPoseOutput,
  QaPoseOutput,
  ReasonCode,
  RenderOutcome,
  RenderPoseOutput,
} from "./types";

const TERMINAL = ["complete", "complete_partial", "failed"] as const;
const isTerminal = (s: JobDoc["status"]) =>
  (TERMINAL as readonly string[]).includes(s);

async function mustJob(jobId: string): Promise<JobDoc> {
  const job = await getJob(jobId);
  if (!job) throw new Error(`unknown job ${jobId}`);
  return job;
}

function attemptRecord(
  job: JobDoc,
  pose: string,
  attempt: number,
): AttemptRecord | undefined {
  if (!Number.isInteger(attempt) || attempt < 1 || attempt > MAX_ATTEMPTS) {
    throw new Error(`attempt must be an integer 1..${MAX_ATTEMPTS}`);
  }
  const state = job.poses[pose];
  if (!state) throw new Error(`job ${job.poseSetId} has no pose ${pose}`);
  return state.attempts?.[String(attempt)];
}

/**
 * The garment images (one for a try-on, two for an outfit, in the prompt's order) and the prompt
 * that names them. An outfit is only ever the Front view.
 */
async function garmentsAndPrompt(
  job: JobDoc,
  pose: Pose,
): Promise<{ garments: InputImage[]; prompt: string }> {
  const ids = kindOf(job) === "outfit" ? (job.itemIds ?? []) : [job.itemId];
  if (ids.length !== (kindOf(job) === "outfit" ? 2 : 1)) {
    throw new Error(`job ${job.poseSetId} has the wrong number of pieces`);
  }
  const items = ids.map((id) => {
    const item = getItem(id);
    if (!item) throw new Error(`unknown catalogue item ${id}`);
    if (!item.category) throw new Error(`${item.id} has no prompt category`);
    return item as typeof item & { category: Category };
  });
  const garments = await Promise.all(items.map((i) => loadItemImage(i.id)));
  if (items.length === 2) {
    if (pose !== "front")
      throw new Error("an outfit is rendered as front only");
    const prompt = buildOutfitPrompt({
      wearing: GENERIC_WEARING,
      pieces: [
        { category: items[0]!.category, target: items[0]!.promptDescription },
        { category: items[1]!.category, target: items[1]!.promptDescription },
      ],
    });
    return { garments, prompt };
  }
  const item = items[0]!;
  return {
    garments,
    prompt: buildPrompt({
      pose,
      category: item.category,
      wearing: GENERIC_WEARING,
      target: item.promptDescription,
    }),
  };
}

/** Marks the job rendering and records which QA checks this build does not run. */
export async function prepare(input: PrepareInput): Promise<PrepareOutput> {
  const job = await mustJob(input.jobId);
  if (job.status === "queued") {
    await updateJob(input.jobId, {
      status: "rendering",
      qaSkipped: [...SKIPPED_CHECKS],
    });
  }
  return { poses: job.poseOrder, maxAttempts: MAX_ATTEMPTS };
}

const OUTCOME_FOR_REASON = {
  blocked: "blocked",
  no_image: "no_image",
  error: "model_error",
} as const;

/**
 * A reservation younger than this may belong to a call that is still running (the endpoint's
 * maxDuration is 300 s plus slack). Older with no outcome means the call died.
 */
export const IN_FLIGHT_MS = 330_000;
/** How long a joining call waits for the owner's outcome; under the endpoint's 300 s limit. */
export const JOIN_WAIT_MS = 270_000;
const JOIN_POLL_MS = 2_000;

export interface RenderPoseDeps {
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  pollMs?: number;
}

/**
 * One model call for (jobId, pose, attempt). Replays return the recorded outcome with no second
 * reservation and no second call. The transactional reserve is the arbiter between overlapping
 * calls: the loser (and any retry that finds a reservation) joins the owner by polling the
 * attempt record. Only a reservation older than IN_FLIGHT_MS with no outcome is treated as a
 * crash, and recovered from the reservation and staged object rather than by calling again.
 */
export async function renderPose(
  input: PoseAttemptInput,
  deps: RenderPoseDeps = {},
): Promise<RenderPoseOutput> {
  const { jobId, pose, attempt } = input;
  const now = deps.now ?? (() => new Date());
  const sleep =
    deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const pollMs = deps.pollMs ?? JOIN_POLL_MS;
  const job = await mustJob(jobId);
  const existing = attemptRecord(job, pose, attempt);
  if (existing?.outcome) return { outcome: existing.outcome };
  if (isTerminal(job.status)) {
    throw new JobTerminalError(`job is ${job.status}; not rendering`);
  }

  const cfg = renderConfigFromEnv();
  const ledger = new FirestoreDailyLedger(cfg.dailyCapUsd);
  const record = async (outcome: RenderOutcome, detail?: string) => {
    await setAttemptRecord(jobId, pose, attempt, { outcome, detail });
    return { outcome };
  };

  // Joins the call that owns this attempt, or recovers if that call died.
  const joinOrRecover = async (): Promise<RenderPoseOutput> => {
    const started = now().getTime();
    for (;;) {
      const fresh = await mustJob(jobId);
      const rec = attemptRecord(fresh, pose, attempt);
      if (rec?.outcome) return { outcome: rec.outcome };
      if (await getStaging(jobId, pose, attempt)) return record("rendered");
      const prior = await ledger.findReservation(jobId, pose, attempt);
      if (!prior) return { outcome: (await renderPoseOnce()).outcome };
      const age = now().getTime() - prior.log.createdAt.toMillis();
      if (age >= IN_FLIGHT_MS) {
        if (prior.log.state === "reserved") {
          // The model may have run and billed; hold the estimate rather than spend again.
          await ledger.settleReservation(prior.id, prior.log.estimateMicros);
        }
        return record(
          "model_error",
          "interrupted before an outcome was recorded",
        );
      }
      if (now().getTime() - started >= JOIN_WAIT_MS) {
        throw new RetryableNodeError(
          `${pose} attempt ${attempt} is still in flight`,
        );
      }
      await sleep(pollMs);
    }
  };

  const renderPoseOnce = async (): Promise<RenderPoseOutput> => {
    // Fast path only; the transactional reserve below decides.
    if (await ledger.findReservation(jobId, pose, attempt)) {
      return joinOrRecover();
    }

    const person = await getPhotoBytes(job.uid, job.photoId);
    if (!person) throw new Error(`no photo stored for ${job.uid}`);
    // Garments first, in the order the prompt names them, then the person last.
    const { garments, prompt } = await garmentsAndPrompt(job, pose as Pose);
    const personImage = { mimeType: person.contentType, data: person.data };

    await setPoseState(jobId, pose, { status: "rendering", attempt });

    let res;
    try {
      res = await renderImage({
        model: cfg.model,
        prompt,
        // Garment(s) first, then the person: the prompt says "Image 1" / "Image 2" (/ "Image 3").
        images: [...garments, personImage],
        aspectRatio: cfg.aspectRatio,
        meter: ledger,
        meta: { jobId, pose, attempt },
      });
    } catch (err) {
      if (err instanceof SpendCeilingError) {
        // The branch ends here (no QA, no retry), so do not leave the pose stuck in "rendering".
        await setPoseState(jobId, pose, {
          status: "failed",
          attempt,
          reasons: ["capacity"],
        });
        return record("capacity", err.message);
      }
      // Another call won the reservation: it owns the model call for this attempt.
      if (err instanceof ReservationExistsError) return joinOrRecover();
      throw err;
    }

    if (!res.ok) return record(OUTCOME_FOR_REASON[res.reason], res.detail);
    await putStaging(jobId, pose, attempt, res.image.data, res.image.mimeType);
    // The user may have deleted their data while the model ran: leave nothing behind.
    if (!(await getJob(jobId))) {
      await deleteStagingForJob(jobId);
      throw new JobTerminalError("job was deleted during the render");
    }
    return record("rendered");
  };

  return renderPoseOnce();
}

const REASON_FOR_OUTCOME: Record<
  Exclude<RenderOutcome, "rendered">,
  ReasonCode
> = {
  blocked: "blocked",
  no_image: "no_image",
  model_error: "model_error",
  capacity: "capacity",
};

/** Runs the gate on the staged image and records the verdict; replays return the record. */
export async function qaPose(input: PoseAttemptInput): Promise<QaPoseOutput> {
  const { jobId, pose, attempt } = input;
  const job = await mustJob(jobId);
  const rec = attemptRecord(job, pose, attempt);
  if (!rec?.outcome) {
    throw new Error(`cannot QA ${pose} attempt ${attempt}: not rendered yet`);
  }
  if (rec.qa) {
    return {
      verdict: rec.qa.verdict,
      reasons: rec.qa.reasons as ReasonCode[],
      next: nextStepForPose({ attempt, verdict: rec.qa.verdict }),
    };
  }

  if (isTerminal(job.status)) {
    throw new JobTerminalError(`job is ${job.status}; not running QA`);
  }

  let verdict: "pass" | "fail";
  let reasons: ReasonCode[];
  if (rec.outcome !== "rendered") {
    verdict = "fail";
    reasons = [REASON_FOR_OUTCOME[rec.outcome]];
  } else {
    const staged = await getStaging(jobId, pose, attempt);
    const person = await getPhotoBytes(job.uid, job.photoId);
    if (!staged || !person) {
      throw new Error(`missing staged render or photo for ${pose} #${attempt}`);
    }
    ({ verdict, reasons } = await checkImage({
      image: staged.data,
      personInput: person.data,
    }));
  }
  await setAttemptRecord(jobId, pose, attempt, { qa: { verdict, reasons } });
  await setPoseState(jobId, pose, { reasons });
  return { verdict, reasons, next: nextStepForPose({ attempt, verdict }) };
}

/** JPEG bytes unchanged if already JPEG; otherwise a plain transcode (no resize or edits). */
async function toJpeg(staged: {
  data: Buffer;
  contentType: string;
}): Promise<Buffer> {
  if (staged.contentType === "image/jpeg") return staged.data;
  return sharp(staged.data)
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

/**
 * Publishes one pose with nothing drawn on it (provenance is shown beside the image, not on it). Refuses unless that attempt's recorded QA verdict is pass.
 * This is the only caller of publishRender in the repo (a test enforces it).
 */
export async function publishPose(
  input: PoseAttemptInput,
  /** Test seam: runs after the terminal check and before the object is written. */
  hooks: { beforeWrite?: () => Promise<void> } = {},
): Promise<PublishPoseOutput> {
  const { jobId, pose, attempt } = input;
  const job = await mustJob(jobId);
  const rec = attemptRecord(job, pose, attempt);
  if (rec?.qa?.verdict !== "pass") {
    throw new Error(
      `refusing to publish ${pose} attempt ${attempt}: no passing QA verdict`,
    );
  }
  if (job.poses[pose]!.status === "passed") return { published: true };
  if (isTerminal(job.status)) {
    throw new JobTerminalError(`refusing to publish into a ${job.status} job`);
  }
  const staged = await getStaging(jobId, pose, attempt);
  if (!staged)
    throw new Error(`no staged render for ${pose} attempt ${attempt}`);

  await hooks.beforeWrite?.();
  await publishRender(job.uid, job.poseSetId, pose, await toJpeg(staged));
  // The set may have failed (or been deleted) between the check above and the write: a render
  // for a failed set must not stay readable, so take it back and do not record the pose.
  const [after, set] = await Promise.all([
    getJob(jobId),
    getPoseSet(job.poseSetId),
  ]);
  if (!after || after.status === "failed" || !set || set.status === "failed") {
    await deleteRender(job.uid, job.poseSetId, pose);
    throw new JobTerminalError("the set ended while publishing");
  }
  await setPoseState(jobId, pose, { status: "passed", attempt });
  await addPoseToSet(job.poseSetId, pose);
  return { published: true };
}

export async function failPose(input: FailPoseInput): Promise<FailPoseOutput> {
  const job = await mustJob(input.jobId);
  const state = job.poses[input.pose];
  if (!state) throw new Error(`job has no pose ${input.pose}`);
  if (state.status === "passed" || state.status === "failed") {
    return { status: state.status };
  }
  await setPoseState(input.jobId, input.pose, { status: "failed" });
  return { status: "failed" };
}

async function withdraw(job: JobDoc, jobId: string): Promise<void> {
  await deleteRendersForPoseSet(job.uid, job.poseSetId);
  await deleteStagingForJob(jobId);
}

/** Routes the set. A failed set withdraws every published render; staging is always cleared. */
export async function finalizeSet(input: {
  jobId: string;
}): Promise<FinalizeSetOutput> {
  const { jobId } = input;
  const job = await mustJob(jobId);

  if (isTerminal(job.status)) {
    // Replay (or a job another node already ended): just make sure staging is gone.
    await deleteStagingForJob(jobId);
    return {
      status: job.status,
      published:
        job.status === "failed"
          ? []
          : job.poseOrder.filter((p) => job.poses[p]?.status === "passed"),
    };
  }

  const statuses = Object.fromEntries(
    job.poseOrder.map((p) => [p, job.poses[p]?.status ?? "pending"]),
  );
  const { status, published } = routeSet(statuses);

  if (status === "failed") {
    await withdraw(job, jobId);
    const code = failureCodeForFailedSet(
      job.poseOrder.map((p) =>
        Object.values(job.poses[p]?.attempts ?? {}).map((a) => a.outcome),
      ),
    );
    await updateJob(jobId, { status: "failed", failure: { code } });
    await updatePoseSet(job.poseSetId, { status: "failed", poses: [] });
  } else {
    await updateJob(jobId, { status });
    await updatePoseSet(job.poseSetId, { status, poses: published });
    await deleteStagingForJob(jobId);
  }
  return { status, published };
}

/**
 * Ends the job as failed: withdraws published renders, clears staging. Never downgrades a job
 * that already finished complete, and never overwrites the first recorded failure.
 */
export async function failJob(input: FailJobInput): Promise<FailJobOutput> {
  const { jobId, code, detail } = input;
  const job = await mustJob(jobId);
  if (job.status === "complete" || job.status === "complete_partial") {
    return { status: job.status };
  }
  await withdraw(job, jobId);
  if (job.status !== "failed") {
    await updateJob(jobId, { status: "failed", failure: { code, detail } });
  }
  await updatePoseSet(job.poseSetId, { status: "failed", poses: [] });
  return { status: "failed" };
}

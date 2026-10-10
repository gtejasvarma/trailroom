import {
  claimDailyStart,
  claimPoseSet,
  createJob,
  DailyLimitError,
  getJob,
  GuestLiveSetError,
  isConsentCurrent,
  kindOf,
  refundDailyStart,
  deleteJob,
  deletePoseSetIfFailed,
  deleteRendersForPoseSet,
  deleteStagingForJob,
  getDefaultPhotoId,
  getPhoto,
  getPoseSet,
  listPoseSetsForUser,
  poseSetId,
  PoseSetExistsError,
  updatePoseSet,
} from "@trailroom/db";
import { closestThree, getItem, isRenderReady } from "@trailroom/catalog";
import { failJob } from "@trailroom/pipeline";
import { PROMPT_VERSION, renderConfigFromEnv } from "@trailroom/render";
import { CONSENT_VERSION } from "../lib/consent";
import { err, ok, type Result } from "./http";
import { dailyStartLimit, STALE_JOB_MS } from "./limits";
import { startRender } from "./orchestrator";
import type { User } from "./auth";

export interface TryOnBody {
  jobId: string;
  poseSetId: string;
  reused: boolean;
}

const LIVE = ["rendering", "complete", "complete_partial"];

export async function startTryOn(
  user: User,
  input: unknown,
  now: Date = new Date(),
): Promise<Result<TryOnBody>> {
  const body = (input ?? {}) as { itemId?: unknown; photoId?: unknown };
  const itemId = body.itemId;
  if (
    typeof itemId !== "string" ||
    itemId.length === 0 ||
    itemId.length > 100
  ) {
    return err("invalid_request");
  }
  if (
    body.photoId !== undefined &&
    (typeof body.photoId !== "string" ||
      body.photoId.length === 0 ||
      body.photoId.length > 100)
  ) {
    return err("invalid_request");
  }

  // Every refusal below happens before any reservation or model call.
  if (!(await isConsentCurrent(user.uid, CONSENT_VERSION))) {
    return err("consent_required");
  }
  // The chosen photo, or the default. Someone else's id is simply not found: no spend, no hint.
  const photoId = body.photoId ?? (await getDefaultPhotoId(user.uid));
  if (!photoId) return err("photo_required");
  let photo;
  try {
    photo = await getPhoto(user.uid, photoId as string);
  } catch {
    return err("not_found");
  }
  if (!photo)
    return err(body.photoId === undefined ? "photo_required" : "not_found");

  const item = getItem(itemId);
  if (!item) return err("unknown_item");
  if (!isRenderReady(item)) {
    return err("not_ready", {
      reasons: item.readinessReasons,
      closest: closestThree(itemId).map((i) => i.id),
    });
  }

  return launchRender(
    user,
    {
      kind: "tryon",
      psId: poseSetId(user.uid, photo.id, itemId),
      photoId: photo.id,
      itemId,
      poses: renderConfigFromEnv().poses as string[],
      promptVersion: PROMPT_VERSION,
    },
    now,
  );
}

export interface LaunchInput {
  kind: "tryon" | "outfit";
  psId: string;
  photoId: string;
  /** The piece (a try-on) or the first of the two (an outfit, canonical order). */
  itemId: string;
  /** An outfit's two pieces in canonical order. */
  itemIds?: [string, string];
  poses: string[];
  promptVersion: string;
}

/**
 * The shared tail of a start, once every free refusal has passed: reuse a live set, clear a failed
 * one, apply the one-at-a-time and daily-start rules, then create the job and set and start the
 * graph. A try-on and an outfit take exactly the same path, so the rules cannot drift apart.
 */
export async function launchRender(
  user: User,
  input: LaunchInput,
  now: Date,
): Promise<Result<TryOnBody>> {
  const { psId, itemId } = input;
  let existing = await getPoseSet(psId);
  if (existing?.status === "rendering") {
    // A job that stopped moving (workflow died, fail-job lost) must not be reused forever.
    const stale = await getJob(existing.jobId);
    if (
      !stale ||
      (["queued", "rendering"].includes(stale.status) &&
        now.getTime() - stale.updatedAt.toMillis() > STALE_JOB_MS)
    ) {
      if (stale) {
        await failJob({
          jobId: existing.jobId,
          code: "internal",
          detail: "stale",
        });
      } else {
        await updatePoseSet(psId, { status: "failed", poses: [] });
      }
      existing = await getPoseSet(psId);
    }
  }
  if (existing && LIVE.includes(existing.status)) {
    return ok({ jobId: existing.jobId, poseSetId: psId, reused: true });
  }
  if (existing) {
    // A failed set: clear it (and what its job left behind) and start a new attempt.
    const removed = await deletePoseSetIfFailed(psId);
    if (removed) {
      await deleteRendersForPoseSet(user.uid, psId);
      await deleteStagingForJob(removed.jobId);
      await deleteJob(removed.jobId);
    }
  }

  // Cheap pre-check for the common case; the transaction below is what decides a race.
  if (user.isGuest) {
    const sets = await listPoseSetsForUser(user.uid);
    if (sets.some((s) => LIVE.includes(s.poseSet.status))) {
      return err("signup_required");
    }
  }

  // One try-on job at a time per person: a second start for a different piece while one is
  // still rendering is refused (no job, no spend, nothing counted). Reusing the same piece's job
  // was answered above; a job that stopped moving is not "rendering" any more. Pre-check, not a
  // lock: two simultaneous starts could both pass, which the daily limit still bounds.
  if (!user.isGuest) {
    const sets = await listPoseSetsForUser(user.uid);
    for (const s of sets) {
      if (s.id === psId || s.poseSet.status !== "rendering") continue;
      // A buffer render is not the person's try-on: it never makes them wait.
      if (kindOf(s.poseSet) === "arrival") continue;
      const j = await getJob(s.poseSet.jobId);
      const alive =
        j &&
        ["queued", "rendering"].includes(j.status) &&
        now.getTime() - j.updatedAt.toMillis() <= STALE_JOB_MS;
      if (alive) return err("job_in_progress", { jobId: s.poseSet.jobId });
    }
  }

  // Counts this start (failed sets count too) and, for a guest, claims their one live set, in a
  // single transaction. Placed after every free refusal and the reuse check, and before the job
  // is created so a refused start leaves nothing behind.
  try {
    await claimDailyStart(
      user.uid,
      dailyStartLimit(user.isGuest),
      now,
      user.isGuest ? { poseSetId: psId } : undefined,
    );
  } catch (e) {
    if (e instanceof GuestLiveSetError) return err("signup_required");
    if (e instanceof DailyLimitError) return err("daily_limit");
    throw e;
  }

  const cfg = renderConfigFromEnv();
  const poses = input.poses;
  const { id: jobId } = await createJob({
    uid: user.uid,
    itemId,
    ...(input.kind === "outfit"
      ? { kind: "outfit" as const, itemIds: input.itemIds }
      : {}),
    photoId: input.photoId,
    poseSetId: psId,
    poseOrder: poses,
    poses: Object.fromEntries(
      poses.map((p) => [p, { status: "pending", attempt: 0, reasons: [] }]),
    ),
    qaSkipped: [],
    model: cfg.model,
    promptVersion: input.promptVersion,
    isGuest: user.isGuest,
  });
  try {
    await claimPoseSet({
      uid: user.uid,
      itemId,
      ...(input.itemIds ? { itemIds: input.itemIds } : {}),
      photoId: input.photoId,
      jobId,
      isGuest: user.isGuest,
    });
  } catch (e) {
    if (e instanceof PoseSetExistsError) {
      // Lost the race to a concurrent request: drop our job and reuse theirs. Reuse is free.
      await deleteJob(jobId);
      await refundDailyStart(user.uid, now).catch(() => undefined);
      const winner = e.existing ?? (await getPoseSet(psId));
      if (winner && LIVE.includes(winner.status)) {
        return ok({ jobId: winner.jobId, poseSetId: psId, reused: true });
      }
      return err("start_failed");
    }
    throw e;
  }

  try {
    await startRender(jobId);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    await failJob({ jobId, code: "internal", detail }).catch(() => undefined);
    return err("start_failed");
  }
  return ok({ jobId, poseSetId: psId, reused: false }, 202);
}

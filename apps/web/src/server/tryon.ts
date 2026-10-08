import {
  claimDailyStart,
  claimPoseSet,
  createJob,
  DailyLimitError,
  getJob,
  GuestLiveSetError,
  isConsentCurrent,
  refundDailyStart,
  deleteJob,
  deletePoseSetIfFailed,
  deleteRendersForPoseSet,
  deleteStagingForJob,
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
  const itemId = (input as { itemId?: unknown } | null)?.itemId;
  if (
    typeof itemId !== "string" ||
    itemId.length === 0 ||
    itemId.length > 100
  ) {
    return err("invalid_request");
  }

  // Every refusal below happens before any reservation or model call.
  if (!(await isConsentCurrent(user.uid, CONSENT_VERSION))) {
    return err("consent_required");
  }
  const photo = await getPhoto(user.uid);
  if (!photo) return err("photo_required");

  const item = getItem(itemId);
  if (!item) return err("unknown_item");
  if (!isRenderReady(item)) {
    return err("not_ready", {
      reasons: item.readinessReasons,
      closest: closestThree(itemId).map((i) => i.id),
    });
  }

  const psId = poseSetId(user.uid, photo.identityVersion, itemId);
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
  const poses = cfg.poses as string[];
  const { id: jobId } = await createJob({
    uid: user.uid,
    itemId,
    identityVersion: photo.identityVersion,
    poseSetId: psId,
    poseOrder: poses,
    poses: Object.fromEntries(
      poses.map((p) => [p, { status: "pending", attempt: 0, reasons: [] }]),
    ),
    qaSkipped: [],
    model: cfg.model,
    promptVersion: PROMPT_VERSION,
    isGuest: user.isGuest,
  });
  try {
    await claimPoseSet({
      uid: user.uid,
      itemId,
      identityVersion: photo.identityVersion,
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

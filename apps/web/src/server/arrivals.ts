// "Arrives on you" (PRD 10.2), and the new-arrivals shelf that needs no render at all.
//
// Two things live here:
//  1. What a person is shown (GET /api/arrivals): published pieces from labels they follow, with
//     the label's own photo and the ordinary "Try it on"; and, only when the buffer made them, up
//     to five cards that are the person's own Front render. A card appears only once its render
//     finished and passed the gate: a failed or unfinished one is never shown, never an error.
//  2. The buffer itself (refillArrivalsFor / runArrivals), driven by the scheduled housekeeping
//     call and off unless ARRIVALS_BUFFER=on. It renders nothing the person did not ask for with
//     the switch off, never for a guest, never for a person who has not seen the last batch.
//
// Decision: buffer renders do NOT count against the person's own daily try-on limit (they did not
// ask for them). They are bounded instead by the batch of five, by "next batch only after the last
// was seen", and by the day's separate ceiling for unrequested renders (ARRIVALS_DAILY_USD), which
// is checked in the same transaction as the daily cap.
import { getItem, isRenderReady, type CatalogItem } from "@trailroom/catalog";
import {
  MAX_ARRIVAL_CARDS,
  arrivalPoseSetId,
  auth,
  claimPoseSet,
  createJob,
  deleteJob,
  deletePoseSetIfFailed,
  deleteRendersForPoseSet,
  deleteStagingForJob,
  FirestoreDailyLedger,
  getArrivals,
  getDefaultPhotoId,
  getFollows,
  getJob,
  getPhoto,
  getPoseSet,
  isConsentCurrent,
  kindOf,
  listFollowersOf,
  listPoseSetsForUser,
  markArrivalsSeen,
  startArrivalBatch,
  type ArrivalsDoc,
  type PoseSetDoc,
} from "@trailroom/db";
import {
  failJob,
  listRecentPublished,
  loadPublishedCatalog,
} from "@trailroom/pipeline";
import {
  PROMPT_VERSION,
  estimateCostUsd,
  logError,
  renderConfigFromEnv,
  usdToMicrosCeil,
} from "@trailroom/render";
import { CONSENT_VERSION } from "../lib/consent";
import {
  ARRIVALS_MAX_PER_RUN,
  ARRIVALS_WINDOW_DAYS,
  arrivalsBufferOn,
} from "./follow-config";
import { err, ok, type Result } from "./http";
import { startRender } from "./orchestrator";
import type { User } from "./auth";

export interface ArrivalsBody {
  /** New pieces from labels the caller follows (label photo, ordinary Try it on). Newest first. */
  pieces: CatalogItem[];
  /** The caller's own pre-rendered Front cards that are ready to show. Empty unless the buffer made some. */
  cards: { itemId: string; poseSetId: string; seen: boolean }[];
}

/** A card whose pose set never appeared is dead after this long. */
const PENDING_GRACE_MS = 30 * 60 * 1000;

export type CardState = "pending" | "ready" | "failed";

export function cardState(
  set: PoseSetDoc | null,
  addedAt: Date,
  now: Date,
): CardState {
  if (!set)
    return now.getTime() - addedAt.getTime() < PENDING_GRACE_MS
      ? "pending"
      : "failed";
  if (set.status === "rendering") return "pending";
  if (set.status === "failed") return "failed";
  return set.poses.includes("front") ? "ready" : "failed";
}

async function cardStates(
  doc: ArrivalsDoc | null,
  now: Date,
): Promise<Map<string, CardState>> {
  const out = new Map<string, CardState>();
  for (const c of doc?.cards ?? []) {
    let set: PoseSetDoc | null = null;
    try {
      set = await getPoseSet(c.poseSetId);
    } catch {
      set = null;
    }
    out.set(c.itemId, cardState(set, c.addedAt.toDate(), now));
  }
  return out;
}

/** GET /api/arrivals. Never an error for something the person did not ask for. */
export async function getArrivalsView(
  user: User,
  now: Date = new Date(),
): Promise<Result<ArrivalsBody>> {
  await loadPublishedCatalog();
  const follows = new Set(await getFollows(user.uid));
  const recent =
    follows.size === 0
      ? []
      : (await listRecentPublished(now, ARRIVALS_WINDOW_DAYS))
          .filter((r) => follows.has(r.item.labelSlug))
          .map((r) => r.item);
  let cards: ArrivalsBody["cards"] = [];
  if (!user.isGuest && arrivalsBufferOn()) {
    const doc = await getArrivals(user.uid);
    const states = await cardStates(doc, now);
    cards = (doc?.cards ?? [])
      .filter((c) => states.get(c.itemId) === "ready" && getItem(c.itemId))
      .map((c) => ({
        itemId: c.itemId,
        poseSetId: c.poseSetId,
        seen: Boolean(c.seenAt),
      }));
  }
  return ok({ pieces: recent, cards });
}

/** POST /api/arrivals/seen { itemIds }: the cards on screen were looked at. */
export async function markSeen(
  user: User,
  input: unknown,
): Promise<Result<{ seen: true }>> {
  const ids = (input as { itemIds?: unknown } | null)?.itemIds;
  if (
    !Array.isArray(ids) ||
    ids.length > MAX_ARRIVAL_CARDS ||
    !ids.every((i) => typeof i === "string" && i.length > 0 && i.length <= 100)
  ) {
    return err("invalid_request");
  }
  if (user.isGuest) return err("account_required");
  await markArrivalsSeen(user.uid, ids as string[]);
  return ok({ seen: true as const });
}

// ---- The buffer ----

export interface Budget {
  /** Renders this run may still start. */
  left: number;
}

async function isAccount(uid: string): Promise<boolean> {
  try {
    return (await auth().getUser(uid)).providerData.length > 0;
  } catch {
    return false;
  }
}

/**
 * Starts the next batch for one person if, and only if, the switch is on, they are a signed-in
 * account with recorded consent and a default photo, the last batch is all seen (or never
 * rendered), and the ceilings leave room. Returns how many renders it started.
 */
export async function refillArrivalsFor(
  uid: string,
  now: Date,
  budget: Budget,
  env: Record<string, string | undefined> = process.env,
): Promise<number> {
  if (!arrivalsBufferOn(env) || budget.left <= 0) return 0;
  if (!(await isAccount(uid))) return 0; // never a guest
  if (!(await isConsentCurrent(uid, CONSENT_VERSION))) return 0;
  const photoId = await getDefaultPhotoId(uid);
  if (!photoId) return 0;
  const photo = await getPhoto(uid, photoId).catch(() => null);
  if (!photo) return 0;
  const follows = new Set(await getFollows(uid));
  if (follows.size === 0) return 0;

  const doc = await getArrivals(uid);
  const states = await cardStates(doc, now);
  // Not yet seen and still alive: wait. This is the rule "refilled only after the last were seen".
  const blocking = (doc?.cards ?? []).some((c) => {
    const s = states.get(c.itemId);
    return s === "pending" || (s === "ready" && !c.seenAt);
  });
  if (blocking) return 0;

  // Failed cards are not shown and not retried, except those cut off by a ceiling: they may be
  // offered again tomorrow.
  const failed = (doc?.cards ?? []).filter(
    (c) => states.get(c.itemId) === "failed",
  );
  const forget: string[] = [];
  for (const c of failed) {
    const set = await getPoseSet(c.poseSetId).catch(() => null);
    const job = set ? await getJob(set.jobId) : null;
    if (job?.failure?.code === "capacity") forget.push(c.itemId);
  }
  const attempted = new Set(
    (doc?.attempted ?? []).filter((i) => !forget.includes(i)),
  );
  const triedOn = new Set(
    (await listPoseSetsForUser(uid))
      .filter(
        (s) => kindOf(s.poseSet) === "tryon" && s.poseSet.status !== "failed",
      )
      .map((s) => s.poseSet.itemId),
  );

  const cfg = renderConfigFromEnv(env);
  const room = Math.min(budget.left, MAX_ARRIVAL_CARDS);
  const candidates = (await listRecentPublished(now, ARRIVALS_WINDOW_DAYS))
    .map((r) => r.item)
    .filter(
      (i) =>
        follows.has(i.labelSlug) &&
        i.shopCategory === "apparel" &&
        i.category !== null &&
        isRenderReady(i) &&
        !attempted.has(i.id) &&
        !triedOn.has(i.id),
    )
    .slice(0, room);
  if (candidates.length === 0) return 0;

  const cards = candidates.map((i) => ({
    itemId: i.id,
    poseSetId: arrivalPoseSetId(uid, photo.id, i.id),
    photoId: photo.id,
  }));
  const done = new Set(
    (doc?.cards ?? [])
      .filter((c) => c.seenAt || states.get(c.itemId) === "failed")
      .map((c) => c.itemId),
  );
  if (!(await startArrivalBatch(uid, cards, done, forget, now))) return 0;

  let started = 0;
  for (const card of cards) {
    try {
      // A stale failed set under this id (a piece offered again after a ceiling) goes first.
      const removed = await deletePoseSetIfFailed(card.poseSetId);
      if (removed) {
        await deleteRendersForPoseSet(uid, card.poseSetId);
        await deleteStagingForJob(removed.jobId);
        await deleteJob(removed.jobId);
      }
      const { id: jobId } = await createJob({
        uid,
        itemId: card.itemId,
        kind: "arrival",
        photoId: card.photoId,
        poseSetId: card.poseSetId,
        poseOrder: ["front"],
        poses: { front: { status: "pending", attempt: 0, reasons: [] } },
        qaSkipped: [],
        model: cfg.model,
        promptVersion: PROMPT_VERSION,
        isGuest: false,
      });
      await claimPoseSet({
        uid,
        itemId: card.itemId,
        photoId: card.photoId,
        jobId,
        isGuest: false,
        arrival: true,
      });
      try {
        await startRender(jobId);
      } catch (e) {
        await failJob({
          jobId,
          code: "internal",
          detail: e instanceof Error ? e.message : String(e),
        }).catch(() => undefined);
        continue;
      }
      started++;
      budget.left--;
    } catch (e) {
      logError("arrivals: card not started", e);
    }
  }
  return started;
}

export interface ArrivalsRunResult {
  enabled: boolean;
  started: number;
  people: number;
}

/**
 * The scheduled fan-out. Off: returns at once and reads nothing. On: for the labels that published
 * in the window, walks their followers (bounded) and refills each buffer that may be refilled, as
 * many renders as BOTH ceilings leave room for (and no more than ARRIVALS_MAX_PER_RUN).
 */
export async function runArrivals(
  now: Date,
  env: Record<string, string | undefined> = process.env,
): Promise<ArrivalsRunResult> {
  const result: ArrivalsRunResult = { enabled: false, started: 0, people: 0 };
  if (!arrivalsBufferOn(env)) return result;
  result.enabled = true;
  const cfg = renderConfigFromEnv(env);
  const ledger = new FirestoreDailyLedger(
    cfg.dailyCapUsd,
    () => now,
    cfg.unrequestedDailyUsd,
  );
  const estimate = usdToMicrosCeil(estimateCostUsd(cfg.model, 2));
  const fit = await ledger.rendersThatFit(estimate, true, now);
  const budget: Budget = { left: Math.min(fit, ARRIVALS_MAX_PER_RUN) };
  if (budget.left <= 0) return result;

  await loadPublishedCatalog({ force: true });
  const labels = [
    ...new Set(
      (await listRecentPublished(now, ARRIVALS_WINDOW_DAYS)).map(
        (r) => r.item.labelSlug,
      ),
    ),
  ];
  const uids = new Set<string>();
  for (const l of labels) for (const u of await listFollowersOf(l)) uids.add(u);
  for (const uid of uids) {
    if (budget.left <= 0) break;
    try {
      const n = await refillArrivalsFor(uid, now, budget, env);
      if (n > 0) {
        result.started += n;
        result.people++;
      }
    } catch (e) {
      logError("arrivals: person failed", e);
    }
  }
  return result;
}

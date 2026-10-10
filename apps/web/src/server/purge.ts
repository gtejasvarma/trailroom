// The Scheduler job. Deletes expired guest sessions (every record and object for the uid, then the
// anonymous Firebase Auth user), sweeps guests who consented and never uploaded, fails jobs that
// stopped moving, settles spend reservations nobody settled, and drops old usage counters.
// Bounded per call so a request cannot run away; the Scheduler job calls it again.
import {
  auth,
  deleteAllForUser,
  deleteExpiredAsks,
  deleteOldEmailKeys,
  deleteOldEmailTokens,
  deleteOldEvents,
  deleteOldUsage,
  deleteConsent,
  FirestoreDailyLedger,
  listExpiredGuestUids,
  listStaleConsentUids,
  listStaleJobs,
  promoteGuest,
} from "@trailroom/db";
import { failJob } from "@trailroom/pipeline";
import { logError, renderConfigFromEnv } from "@trailroom/render";
import { runArrivals } from "./arrivals";
import { runEmail } from "./email/run";
import { STALE_JOB_MS } from "./limits";

export const PURGE_BATCH = 200;
/** A reservation this old is not an in-flight call (calls last at most ~5 minutes). */
export const REAP_AFTER_MS = 15 * 60 * 1000;

export interface PurgeResult {
  purged: number;
  /** Linked accounts found among "expired guests" and promoted instead of deleted. */
  promoted: number;
  consentOnly: number;
  reaped: number;
  staleJobs: number;
  usageDeleted: number;
  /** Asks deleted 30 days after their link expired. */
  asksDeleted: number;
  /** The follow loop: buffer renders started (0 with ARRIVALS_BUFFER off) and emails sent (0 with transport none). */
  arrivalsStarted: number;
  emailsSent: number;
}

type AuthUserLike = { providerData: unknown[] };
async function authUser(uid: string): Promise<AuthUserLike | null> {
  try {
    return await auth().getUser(uid);
  } catch (e) {
    if ((e as { code?: string }).code === "auth/user-not-found") return null;
    throw e;
  }
}
const isLinked = (u: AuthUserLike | null) =>
  u !== null && u.providerData.length > 0;

async function deleteAuthUser(uid: string): Promise<void> {
  try {
    await auth().deleteUser(uid);
  } catch (e) {
    if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
  }
}

/** Events and email keys are read for a week; tokens work for 400 days. */
const EVENT_KEEP_MS = 45 * 24 * 60 * 60 * 1000;
const TOKEN_KEEP_MS = 400 * 24 * 60 * 60 * 1000;

export async function purgeExpiredGuests(
  now: Date = new Date(),
  /** The absolute origin links in emails are built on (see originOf in asks.ts). */
  origin: string = process.env.INTERNAL_AUDIENCE ?? "",
): Promise<PurgeResult> {
  const result: PurgeResult = {
    purged: 0,
    promoted: 0,
    consentOnly: 0,
    reaped: 0,
    staleJobs: 0,
    usageDeleted: 0,
    asksDeleted: 0,
    arrivalsStarted: 0,
    emailsSent: 0,
  };

  // Expired guests.
  for (const uid of await listExpiredGuestUids(now, PURGE_BATCH)) {
    try {
      // A guest who linked a real provider but whose attach call never arrived is an account,
      // not a guest: promote it instead of deleting its data and user.
      if (isLinked(await authUser(uid))) {
        await promoteGuest(uid);
        result.promoted++;
        continue;
      }
      await deleteAllForUser(uid);
      await deleteAuthUser(uid);
      result.purged++;
    } catch (e) {
      // One bad uid must not block the rest; it is retried on the next run.
      logError("purge: guest failed", e);
    }
  }

  // Guests who consented and never uploaded.
  try {
    for (const uid of await listStaleConsentUids(now, PURGE_BATCH)) {
      try {
        if (isLinked(await authUser(uid))) continue;
        await deleteConsent(uid);
        await deleteAuthUser(uid);
        result.consentOnly++;
      } catch (e) {
        logError("purge: consent-only guest failed", e);
      }
    }
  } catch (e) {
    logError("purge: consent sweep failed", e);
  }

  // Jobs that stopped moving.
  try {
    const cutoff = new Date(now.getTime() - STALE_JOB_MS);
    for (const { id } of await listStaleJobs(cutoff, PURGE_BATCH)) {
      try {
        await failJob({ jobId: id, code: "internal", detail: "stale" });
        result.staleJobs++;
      } catch (e) {
        logError("purge: stale job failed", e);
      }
    }
  } catch (e) {
    logError("purge: stale job sweep failed", e);
  }

  // Spend reservations nobody settled: hold their estimate rather than release the cap.
  try {
    const ledger = new FirestoreDailyLedger(renderConfigFromEnv().dailyCapUsd);
    result.reaped = await ledger.reapStaleReservations(REAP_AFTER_MS, now);
    if (result.reaped > 0) {
      console.log(`purge: settled ${result.reaped} stale spend reservations`);
    }
  } catch (e) {
    logError("purge: reservation reaper failed", e);
  }

  try {
    result.asksDeleted = await deleteExpiredAsks(now, PURGE_BATCH);
  } catch (e) {
    logError("purge: expired asks failed", e);
  }

  // The follow loop. Each step is a no-op unless its switch is on, and a failure in one never
  // stops the housekeeping above or the other step.
  try {
    result.arrivalsStarted = (await runArrivals(now)).started;
  } catch (e) {
    logError("purge: arrivals failed", e);
  }
  try {
    const sent = await runEmail(now, origin.replace(/\/+$/, ""));
    result.emailsSent = sent.news + sent.price;
  } catch (e) {
    logError("purge: email failed", e);
  }
  try {
    await deleteOldEvents(new Date(now.getTime() - EVENT_KEEP_MS));
    await deleteOldEmailKeys(new Date(now.getTime() - EVENT_KEEP_MS));
    await deleteOldEmailTokens(new Date(now.getTime() - TOKEN_KEEP_MS));
  } catch (e) {
    logError("purge: follow loop cleanup failed", e);
  }

  try {
    result.usageDeleted = await deleteOldUsage(now);
  } catch (e) {
    logError("purge: usage cleanup failed", e);
  }
  return result;
}

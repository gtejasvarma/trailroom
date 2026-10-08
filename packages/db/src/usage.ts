// Per-user daily limits. usage/{uid}_{yyyy-mm-dd} (UTC) is server-only (the rules catch-all
// denies clients). It holds the count of try-on starts and, for guests, the claim on their one
// live set, so both decisions are made inside one transaction on one document.
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "./app";
import { assertSegment } from "./paths";
import { utcDay } from "./ledger";
import type { PoseSetDoc } from "./types";

export interface UsageDoc {
  uid: string;
  day: string;
  starts: number;
  updatedAt: Timestamp;
  /** Guests only: the pose set this guest started most recently, and when. */
  guestSetId?: string;
  guestClaimedAt?: Timestamp;
}

export class DailyLimitError extends Error {
  constructor(readonly limit: number) {
    super(`daily try-on limit of ${limit} reached`);
    this.name = "DailyLimitError";
  }
}

/** A guest already has a live set (or is mid-claim on one). */
export class GuestLiveSetError extends Error {
  constructor() {
    super("guest already has a live pose set");
    this.name = "GuestLiveSetError";
  }
}

const LIVE = ["rendering", "complete", "complete_partial"];
/** A claim whose pose set doc never appeared is treated as dead after this long. */
const CLAIM_GRACE_MS = 2 * 60 * 1000;
const USAGE_KEEP_MS = 3 * 24 * 60 * 60 * 1000;

const col = () => firestore().collection("usage");
export const usageId = (uid: string, day: string) =>
  `${assertSegment("uid", uid)}_${day}`;

/**
 * Counts one try-on start for today (UTC) and throws DailyLimitError at `limit`. Failed sets
 * count; nothing decrements except refundDailyStart on a lost start race. With `guest`, the same
 * transaction refuses (GuestLiveSetError) when the guest's previous claim still points at a live
 * pose set, so two concurrent starts by one guest cannot both pass.
 */
export async function claimDailyStart(
  uid: string,
  limit: number,
  now: Date = new Date(),
  guest?: { poseSetId: string },
): Promise<void> {
  const ref = col().doc(usageId(uid, utcDay(now)));
  await firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists ? (snap.data() as UsageDoc) : null;
    if (guest && cur?.guestSetId && cur.guestSetId !== guest.poseSetId) {
      const setSnap = await tx.get(
        firestore().collection("poseSets").doc(cur.guestSetId),
      );
      const live = setSnap.exists
        ? LIVE.includes((setSnap.data() as PoseSetDoc).status)
        : now.getTime() - (cur.guestClaimedAt?.toMillis() ?? 0) <
          CLAIM_GRACE_MS;
      if (live) throw new GuestLiveSetError();
    }
    if ((cur?.starts ?? 0) >= limit) throw new DailyLimitError(limit);
    tx.set(ref, {
      uid,
      day: utcDay(now),
      starts: (cur?.starts ?? 0) + 1,
      updatedAt: Timestamp.fromDate(now),
      ...(guest
        ? {
            guestSetId: guest.poseSetId,
            guestClaimedAt: Timestamp.fromDate(now),
          }
        : {}),
    } satisfies UsageDoc);
  });
}

/** Gives back a start that turned out to be a reuse (a concurrent request won the same key). */
export async function refundDailyStart(
  uid: string,
  now: Date = new Date(),
): Promise<void> {
  const ref = col().doc(usageId(uid, utcDay(now)));
  await firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const cur = snap.data() as UsageDoc;
    tx.update(ref, {
      starts: Math.max(0, cur.starts - 1),
      guestSetId: null,
      updatedAt: Timestamp.fromDate(now),
    });
  });
}

export async function getUsage(
  uid: string,
  now: Date = new Date(),
): Promise<UsageDoc | null> {
  const snap = await col()
    .doc(usageId(uid, utcDay(now)))
    .get();
  return snap.exists ? (snap.data() as UsageDoc) : null;
}

/** Usage docs older than 3 days. Not touched by deleteAllForUser, so deleting data never resets a count. */
export async function deleteOldUsage(now: Date = new Date()): Promise<number> {
  const cutoff = Timestamp.fromMillis(now.getTime() - USAGE_KEEP_MS);
  let n = 0;
  for (;;) {
    const snap = await col().where("updatedAt", "<", cutoff).limit(400).get();
    if (snap.empty) return n;
    const batch = firestore().batch();
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();
    n += snap.size;
  }
}

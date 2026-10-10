// arrivals/{uid}: the "arrives on you" buffer (PRD §10.2). At most five cards, one batch at a time:
// a new batch starts only when every card of the last one was seen (or never rendered). Server-only.
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "./app";
import { assertSegment } from "./paths";

export const MAX_ARRIVAL_CARDS = 5;
/** Pieces already offered to a person (shown or failed) are remembered, newest this many. */
export const MAX_ATTEMPTED = 200;

export interface ArrivalCard {
  itemId: string;
  /** Deterministic: arrivalPoseSetId(uid, photoId, itemId). */
  poseSetId: string;
  photoId: string;
  addedAt: Timestamp;
  seenAt: Timestamp | null;
}

export interface ArrivalsDoc {
  cards: ArrivalCard[];
  /** Pieces that have had a card (so one is never offered twice). */
  attempted: string[];
  updatedAt: Timestamp;
}

const ref = (uid: string) =>
  firestore().collection("arrivals").doc(assertSegment("uid", uid));

/** The arrival pose set's id: the try-on's id plus ".arr", so it can never collide with a try-on. */
export function arrivalPoseSetId(
  uid: string,
  photoId: string,
  itemId: string,
): string {
  return assertSegment(
    "poseSetId",
    `${assertSegment("uid", uid)}_${assertSegment("photoId", photoId)}_${assertSegment("itemId", itemId)}.arr`,
  );
}

export async function getArrivals(uid: string): Promise<ArrivalsDoc | null> {
  const snap = await ref(uid).get();
  return snap.exists ? (snap.data() as ArrivalsDoc) : null;
}

/**
 * Starts a new batch, in one transaction. Refused (false) unless every card now held is `done`
 * (seen, or failed/dropped, as the caller worked out from the pose sets) and the new cards number
 * 1 to five. This is the only writer of `cards`, so the buffer can never hold more than five.
 */
export async function startArrivalBatch(
  uid: string,
  cards: Omit<ArrivalCard, "addedAt" | "seenAt">[],
  doneItemIds: ReadonlySet<string>,
  forgetItemIds: readonly string[] = [],
  now: Date = new Date(),
): Promise<boolean> {
  if (cards.length < 1 || cards.length > MAX_ARRIVAL_CARDS) return false;
  const r = ref(uid);
  return firestore().runTransaction(async (tx) => {
    const snap = await tx.get(r);
    const cur = snap.exists ? (snap.data() as ArrivalsDoc) : null;
    const forget = new Set(forgetItemIds);
    const held = cur?.cards ?? [];
    if (held.some((c) => !c.seenAt && !doneItemIds.has(c.itemId))) return false;
    const attempted = (cur?.attempted ?? []).filter((i) => !forget.has(i));
    for (const c of cards)
      if (!attempted.includes(c.itemId)) attempted.push(c.itemId);
    const at = Timestamp.fromDate(now);
    tx.set(r, {
      cards: cards.map((c) => ({ ...c, addedAt: at, seenAt: null })),
      attempted: attempted.slice(-MAX_ATTEMPTED),
      updatedAt: at,
    } satisfies ArrivalsDoc);
    return true;
  });
}

/** Marks cards seen. Only pieces that are cards are touched; a repeat changes nothing. */
export async function markArrivalsSeen(
  uid: string,
  itemIds: readonly string[],
  now: Date = new Date(),
): Promise<void> {
  const r = ref(uid);
  await firestore().runTransaction(async (tx) => {
    const snap = await tx.get(r);
    if (!snap.exists) return;
    const cur = snap.data() as ArrivalsDoc;
    const want = new Set(itemIds);
    let changed = false;
    const cards = cur.cards.map((c) => {
      if (c.seenAt || !want.has(c.itemId)) return c;
      changed = true;
      return { ...c, seenAt: Timestamp.fromDate(now) };
    });
    if (changed) tx.update(r, { cards, updatedAt: Timestamp.fromDate(now) });
  });
}

/** Drops cards (a failed render is simply not shown); their pieces stay in `attempted`. */
export async function dropArrivalCards(
  uid: string,
  itemIds: readonly string[],
  forget: readonly string[] = [],
): Promise<void> {
  const r = ref(uid);
  await firestore().runTransaction(async (tx) => {
    const snap = await tx.get(r);
    if (!snap.exists) return;
    const cur = snap.data() as ArrivalsDoc;
    const drop = new Set(itemIds);
    const gone = new Set(forget);
    tx.update(r, {
      cards: cur.cards.filter((c) => !drop.has(c.itemId)),
      attempted: cur.attempted.filter((i) => !gone.has(i)),
      updatedAt: Timestamp.now(),
    });
  });
}

export async function deleteArrivals(uid: string): Promise<void> {
  await ref(uid).delete();
}

/** Uids that follow a label (the follows document lists slugs). */
export async function listFollowersOf(
  labelSlug: string,
  limit = 200,
): Promise<string[]> {
  const snap = await firestore()
    .collection("follows")
    .where("labels", "array-contains", assertSegment("labelSlug", labelSlug))
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.id);
}

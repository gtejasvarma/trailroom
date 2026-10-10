// asks/{askId} and asks/{askId}/votes/{voterKey}, plus inbox/{uid}/asks/{askId}.
// Server-only. The raw link token is never stored (see askToken.ts); the public page looks an ask
// up by the hash of the token. Nothing here returns who voted for what to the asker.
import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import { firestore } from "./app";
import {
  hashAskToken,
  isAskTokenShape,
  newAskToken,
  newVoterKey,
} from "./askToken";
import { assertSegment } from "./paths";
import {
  ASK_RETENTION_MS,
  ASK_TTL_MS,
  MAX_LIVE_ASKS,
  MAX_VOTES_PER_ASK,
  type AskDoc,
  type InboxAskDoc,
  type VoteDoc,
} from "./types";

const asks = () => firestore().collection("asks");
const votesOf = (askId: string) => asks().doc(askId).collection("votes");
const inboxOf = (uid: string) =>
  firestore()
    .collection("inbox")
    .doc(assertSegment("uid", uid))
    .collection("asks");

export type AskWithId = { id: string; ask: AskDoc };

export const isAskLive = (ask: AskDoc, now: Date = new Date()): boolean =>
  ask.revokedAt === null && ask.expiresAt.toMillis() > now.getTime();

export interface CreateAskInput {
  uid: string;
  askerFirstName: string;
  listId: string;
  listName: string;
  question: string | null;
  itemIds: string[];
  poseSetIds: Record<string, string | null>;
  /** The job id of each frozen pose set; omitted means no render is shown for any piece. */
  poseSetJobIds?: Record<string, string | null>;
}

/** Creates the ask and returns the raw token: the only time it exists outside the link. */
export async function createAskFor(
  input: CreateAskInput,
  now: Date = new Date(),
): Promise<
  | { ok: true; id: string; token: string; ask: AskDoc }
  | { ok: false; error: "ask_limit" }
> {
  assertSegment("uid", input.uid);
  const { token, hash } = newAskToken();
  const ref = asks().doc();
  const ask: AskDoc = {
    uid: input.uid,
    askerFirstName: input.askerFirstName,
    listId: input.listId,
    listName: input.listName,
    question: input.question,
    itemIds: input.itemIds,
    poseSetIds: input.poseSetIds,
    poseSetJobIds: input.poseSetJobIds ?? {},
    tokenHash: hash,
    createdAt: Timestamp.fromDate(now),
    expiresAt: Timestamp.fromMillis(now.getTime() + ASK_TTL_MS),
    revokedAt: null,
    counts: Object.fromEntries(input.itemIds.map((i) => [i, 0])),
    voteCount: 0,
    openedBy: [],
  };
  return firestore().runTransaction(async (tx) => {
    const mine = await tx.get(asks().where("uid", "==", input.uid));
    const live = mine.docs.filter((d) => isAskLive(d.data() as AskDoc, now));
    if (live.length >= MAX_LIVE_ASKS)
      return { ok: false as const, error: "ask_limit" as const };
    tx.create(ref, ask);
    return { ok: true as const, id: ref.id, token, ask };
  });
}

/** Looks up by the hash of the token. A token of the wrong shape never reaches Firestore. */
export async function getAskByToken(token: unknown): Promise<AskWithId | null> {
  if (!isAskTokenShape(token)) return null;
  const snap = await asks()
    .where("tokenHash", "==", hashAskToken(token))
    .limit(1)
    .get();
  const d = snap.docs[0];
  return d ? { id: d.id, ask: d.data() as AskDoc } : null;
}

/** By id, with no ownership check: callers must have their own reason to show it (an inbox entry). */
export async function getAskById(id: string): Promise<AskWithId | null> {
  let ref;
  try {
    ref = asks().doc(assertSegment("askId", id));
  } catch {
    return null;
  }
  const snap = await ref.get();
  return snap.exists ? { id, ask: snap.data() as AskDoc } : null;
}

export async function getAskFor(
  uid: string,
  id: string,
): Promise<AskWithId | null> {
  let ref;
  try {
    ref = asks().doc(assertSegment("askId", id));
  } catch {
    return null;
  }
  const snap = await ref.get();
  if (!snap.exists) return null;
  const ask = snap.data() as AskDoc;
  return ask.uid === uid ? { id, ask } : null;
}

/** The person's asks, newest first (every one they have not had purged). */
export async function listAsksForUser(uid: string): Promise<AskWithId[]> {
  const snap = await asks().where("uid", "==", assertSegment("uid", uid)).get();
  return snap.docs
    .map((d) => ({ id: d.id, ask: d.data() as AskDoc }))
    .sort((a, b) => b.ask.createdAt.toMillis() - a.ask.createdAt.toMillis());
}

/** Revokes one of the caller's asks. Returns false when it is not theirs or does not exist. */
export async function revokeAskFor(
  uid: string,
  id: string,
  now: Date = new Date(),
): Promise<boolean> {
  const found = await getAskFor(uid, id);
  if (!found) return false;
  if (found.ask.revokedAt === null)
    await asks()
      .doc(id)
      .update({ revokedAt: Timestamp.fromDate(now) });
  return true;
}

/** Revokes every live ask made from a list (the list was deleted). */
export async function revokeAsksForList(
  uid: string,
  listId: string,
  now: Date = new Date(),
): Promise<number> {
  const mine = await listAsksForUser(uid);
  const todo = mine.filter(
    (a) => a.ask.listId === listId && a.ask.revokedAt === null,
  );
  await Promise.all(
    todo.map((a) =>
      asks()
        .doc(a.id)
        .update({ revokedAt: Timestamp.fromDate(now) }),
    ),
  );
  return todo.length;
}

export const getVote = async (
  askId: string,
  voterKey: string,
): Promise<VoteDoc | null> => {
  const snap = await votesOf(assertSegment("askId", askId))
    .doc(assertSegment("voterKey", voterKey))
    .get();
  return snap.exists ? (snap.data() as VoteDoc) : null;
};

export type VoteResult =
  | { ok: true; counts: Record<string, number>; changed: boolean }
  | { ok: false; error: "closed" | "bad_item" | "full" };

/**
 * One vote per voter. A new vote adds to the piece's count; changing it moves the count from the
 * old piece to the new one. All in one transaction, retried under contention.
 */
export async function castVote(
  askId: string,
  voterKey: string,
  voterUid: string | null,
  itemId: string,
  now: Date = new Date(),
): Promise<VoteResult> {
  const askRef = asks().doc(assertSegment("askId", askId));
  const voteRef = votesOf(askId).doc(assertSegment("voterKey", voterKey));
  return firestore().runTransaction(
    async (tx) => {
      const [askSnap, voteSnap] = await Promise.all([
        tx.get(askRef),
        tx.get(voteRef),
      ]);
      const ask = askSnap.exists ? (askSnap.data() as AskDoc) : null;
      if (!ask || !isAskLive(ask, now))
        return { ok: false as const, error: "closed" as const };
      if (!ask.itemIds.includes(itemId))
        return { ok: false as const, error: "bad_item" as const };
      const prev = voteSnap.exists ? (voteSnap.data() as VoteDoc) : null;
      const counts = { ...ask.counts };
      if (prev?.itemId === itemId)
        return { ok: true as const, counts, changed: false };
      // Asks from before the counter existed hold as many votes as their counts add up to.
      const held =
        ask.voteCount ?? Object.values(ask.counts).reduce((a, b) => a + b, 0);
      if (!prev && held >= MAX_VOTES_PER_ASK)
        return { ok: false as const, error: "full" as const };
      if (!prev) tx.update(askRef, { voteCount: held + 1 });
      if (prev) {
        counts[prev.itemId] = Math.max(0, (counts[prev.itemId] ?? 0) - 1);
        tx.update(
          askRef,
          new FieldPath("counts", prev.itemId),
          FieldValue.increment(-1),
        );
      }
      counts[itemId] = (counts[itemId] ?? 0) + 1;
      tx.update(
        askRef,
        new FieldPath("counts", itemId),
        FieldValue.increment(1),
      );
      const vote: VoteDoc = {
        itemId,
        createdAt: Timestamp.fromDate(now),
        voterUid,
      };
      tx.set(voteRef, vote);
      return { ok: true as const, counts, changed: true };
    },
    { maxAttempts: 30 },
  );
}

/** Removes the inbox entry each person who opened the ask holds for it. */
async function clearInboxEntries(askId: string, ask: AskDoc): Promise<void> {
  for (const friend of ask.openedBy ?? []) {
    try {
      await inboxOf(friend).doc(askId).delete();
    } catch {
      // A malformed uid in the list must not stop the rest.
    }
  }
}

/** Deletes every ask the person made, with its votes and the inbox entries it left in friends' inboxes. */
export async function deleteAsksForUser(uid: string): Promise<void> {
  const mine = await listAsksForUser(uid);
  const db = firestore();
  for (const a of mine) {
    await clearInboxEntries(a.id, a.ask);
    await db.recursiveDelete(asks().doc(a.id));
  }
}

/** Deletes one inbox entry (its ask is gone). */
export async function deleteInboxAsk(uid: string, askId: string) {
  await inboxOf(uid).doc(assertSegment("askId", askId)).delete();
}

/**
 * The person's votes on other people's asks keep their count but lose the link to them: each vote
 * doc (keyed by their uid) is replaced by one under a random key with `voterUid` null.
 */
export async function anonymiseVotesBy(uid: string): Promise<number> {
  assertSegment("uid", uid);
  const db = firestore();
  const snap = await db
    .collectionGroup("votes")
    .where("voterUid", "==", uid)
    .get();
  for (const d of snap.docs) {
    const vote = d.data() as VoteDoc;
    const batch = db.batch();
    batch.delete(d.ref);
    batch.set(d.ref.parent.doc(newVoterKey()), { ...vote, voterUid: null });
    await batch.commit();
  }
  return snap.size;
}

/** Deletes asks whose link expired more than 30 days ago (with their votes). */
export async function deleteExpiredAsks(
  now: Date = new Date(),
  limit = 200,
): Promise<number> {
  const cutoff = Timestamp.fromMillis(now.getTime() - ASK_RETENTION_MS);
  const snap = await asks().where("expiresAt", "<=", cutoff).limit(limit).get();
  const db = firestore();
  for (const d of snap.docs) {
    await clearInboxEntries(d.id, d.data() as AskDoc);
    await db.recursiveDelete(d.ref);
  }
  return snap.size;
}

// ---- inbox ----

export type InboxWithId = { askId: string; entry: InboxAskDoc };

/** The most people an ask remembers as having opened it; past that no inbox entry is made. */
const MAX_OPENED_BY = 500;

/**
 * First open creates the entry (unread); later opens leave it alone. The ask remembers the uid
 * (`openedBy`) so that deleting the ask can clear the entry; an ask that is gone makes none.
 */
export async function openInboxAsk(
  uid: string,
  askId: string,
  ask: Pick<AskDoc, "askerFirstName" | "question" | "itemIds">,
  votedItemId: string | null,
  now: Date = new Date(),
): Promise<void> {
  const ref = inboxOf(uid).doc(assertSegment("askId", askId));
  const askRef = asks().doc(askId);
  await firestore().runTransaction(async (tx) => {
    const [snap, askSnap] = await Promise.all([tx.get(ref), tx.get(askRef)]);
    if (!askSnap.exists) return;
    const opened = (askSnap.data() as AskDoc).openedBy ?? [];
    const tracked = opened.includes(uid);
    if (!tracked && opened.length >= MAX_OPENED_BY) return;
    if (!tracked) tx.update(askRef, { openedBy: FieldValue.arrayUnion(uid) });
    if (snap.exists) return;
    const entry: InboxAskDoc = {
      askerFirstName: ask.askerFirstName,
      question: ask.question,
      itemIds: ask.itemIds,
      firstOpenedAt: Timestamp.fromDate(now),
      votedItemId,
      unread: votedItemId === null,
    };
    tx.create(ref, entry);
  });
}

export async function setInboxVote(
  uid: string,
  askId: string,
  itemId: string,
): Promise<void> {
  await inboxOf(uid)
    .doc(assertSegment("askId", askId))
    .set({ votedItemId: itemId, unread: false }, { merge: true });
}

export async function markInboxRead(uid: string, askId: string): Promise<void> {
  const ref = inboxOf(uid).doc(assertSegment("askId", askId));
  if ((await ref.get()).exists) await ref.update({ unread: false });
}

export async function listInbox(uid: string): Promise<InboxWithId[]> {
  const snap = await inboxOf(uid).get();
  return snap.docs
    .map((d) => ({ askId: d.id, entry: d.data() as InboxAskDoc }))
    .sort(
      (a, b) =>
        b.entry.firstOpenedAt.toMillis() - a.entry.firstOpenedAt.toMillis(),
    );
}

export async function getInboxAsk(
  uid: string,
  askId: string,
): Promise<InboxAskDoc | null> {
  const snap = await inboxOf(uid).doc(assertSegment("askId", askId)).get();
  return snap.exists ? (snap.data() as InboxAskDoc) : null;
}

export async function deleteInboxForUser(uid: string): Promise<void> {
  await firestore().recursiveDelete(inboxOf(uid));
}

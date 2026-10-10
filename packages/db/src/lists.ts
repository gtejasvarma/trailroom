// lists/{listId}: named lists of catalogue pieces. Server-only; every read and write here is by
// uid, and a list that is not the caller's reads as missing.
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "./app";
import { assertSegment } from "./paths";
import { MAX_LISTS, MAX_LIST_ITEMS, type ListDoc } from "./types";

const col = () => firestore().collection("lists");

export type ListWithId = { id: string; list: ListDoc };
export type ListError =
  "not_found" | "list_limit" | "list_full" | "invalid_request";

/** Newest first. */
export async function listListsForUser(uid: string): Promise<ListWithId[]> {
  const snap = await col().where("uid", "==", assertSegment("uid", uid)).get();
  return snap.docs
    .map((d) => ({ id: d.id, list: d.data() as ListDoc }))
    .sort((a, b) => b.list.createdAt.toMillis() - a.list.createdAt.toMillis());
}

/** The list, only when it belongs to `uid`. */
export async function getListFor(
  uid: string,
  id: string,
): Promise<ListWithId | null> {
  let ref;
  try {
    ref = col().doc(assertSegment("listId", id));
  } catch {
    return null;
  }
  const snap = await ref.get();
  if (!snap.exists) return null;
  const list = snap.data() as ListDoc;
  return list.uid === uid ? { id, list } : null;
}

/** Creates a list (optionally with one piece), enforcing the per-person limit in a transaction. */
export async function createListFor(
  uid: string,
  name: string,
  itemId?: string,
  now: Date = new Date(),
): Promise<{ ok: true; value: ListWithId } | { ok: false; error: ListError }> {
  assertSegment("uid", uid);
  const db = firestore();
  const ref = col().doc();
  const doc: ListDoc = {
    uid,
    name,
    itemIds: itemId ? [itemId] : [],
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  };
  return db.runTransaction(async (tx) => {
    const mine = await tx.get(col().where("uid", "==", uid));
    if (mine.size >= MAX_LISTS)
      return { ok: false as const, error: "list_limit" as const };
    tx.create(ref, doc);
    return { ok: true as const, value: { id: ref.id, list: doc } };
  });
}

export interface ListChange {
  name?: string;
  add?: string;
  remove?: string;
}

/** Rename, add one piece (idempotent), remove one piece (idempotent): in one transaction. */
export async function changeListFor(
  uid: string,
  id: string,
  change: ListChange,
  now: Date = new Date(),
): Promise<{ ok: true; value: ListWithId } | { ok: false; error: ListError }> {
  let ref;
  try {
    ref = col().doc(assertSegment("listId", id));
  } catch {
    return { ok: false, error: "not_found" };
  }
  return firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists ? (snap.data() as ListDoc) : null;
    if (!cur || cur.uid !== uid)
      return { ok: false as const, error: "not_found" as const };
    let itemIds = cur.itemIds;
    if (change.add && !itemIds.includes(change.add)) {
      if (itemIds.length >= MAX_LIST_ITEMS)
        return { ok: false as const, error: "list_full" as const };
      itemIds = [...itemIds, change.add];
    }
    if (change.remove) itemIds = itemIds.filter((i) => i !== change.remove);
    const next: ListDoc = {
      ...cur,
      name: change.name ?? cur.name,
      itemIds,
      updatedAt: Timestamp.fromDate(now),
    };
    tx.set(ref, next);
    return { ok: true as const, value: { id, list: next } };
  });
}

/** Deletes the list if it is the caller's. Returns whether it existed. */
export async function deleteListFor(uid: string, id: string): Promise<boolean> {
  const found = await getListFor(uid, id);
  if (!found) return false;
  await col().doc(id).delete();
  return true;
}

export async function deleteListsForUser(uid: string): Promise<void> {
  const snap = await col().where("uid", "==", assertSegment("uid", uid)).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

// lists/{listId}: named lists of catalogue pieces. Server-only; every read and write here is by
// uid, and a list that is not the caller's reads as missing.
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "./app";
import { assertSegment } from "./paths";
import {
  FAVOURITES_NAME,
  MAX_FAVOURITES,
  MAX_LISTS,
  MAX_LIST_ITEMS,
  expiryFor,
  type ListDoc,
} from "./types";

const col = () => firestore().collection("lists");

export type ListWithId = { id: string; list: ListDoc };
export type ListError =
  "not_found" | "list_limit" | "list_full" | "invalid_request" | "protected";

/**
 * The id of a person's Favourites list. It is fixed per person, so there can only ever be one
 * (a second create is the same document), and a read can say "empty" without writing anything.
 */
export const favouritesIdFor = (uid: string): string =>
  `fav_${assertSegment("uid", uid)}`;

export const isFavourites = (l: ListDoc): boolean => l.kind === "favourites";

/** A Favourites list that has not been saved yet. */
export function blankFavourites(
  uid: string,
  isGuest: boolean,
  now: Date = new Date(),
): ListDoc {
  return {
    uid,
    name: FAVOURITES_NAME,
    kind: "favourites",
    itemIds: [],
    isGuest,
    expiresAt: expiryFor(isGuest, now),
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now),
  };
}

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
    // Favourites is the default list: it never counts against the limit.
    if (
      mine.docs.filter((d) => !isFavourites(d.data() as ListDoc)).length >=
      MAX_LISTS
    )
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
  /** Who is asking: it only matters when this call is what creates their Favourites. */
  isGuest = false,
): Promise<{ ok: true; value: ListWithId } | { ok: false; error: ListError }> {
  let ref;
  try {
    ref = col().doc(assertSegment("listId", id));
  } catch {
    return { ok: false, error: "not_found" };
  }
  return firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    // Favourites is created by the first save into it.
    const cur = snap.exists
      ? (snap.data() as ListDoc)
      : id === favouritesIdFor(uid) && change.add
        ? blankFavourites(uid, isGuest, now)
        : null;
    if (!cur || cur.uid !== uid)
      return { ok: false as const, error: "not_found" as const };
    if (isFavourites(cur) && change.name !== undefined)
      return { ok: false as const, error: "protected" as const };
    let itemIds = cur.itemIds;
    if (change.add && !itemIds.includes(change.add)) {
      const cap = isFavourites(cur) ? MAX_FAVOURITES : MAX_LIST_ITEMS;
      if (itemIds.length >= cap)
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
  if (!found || isFavourites(found.list)) return false;
  await col().doc(id).delete();
  return true;
}

export async function deleteListsForUser(uid: string): Promise<void> {
  const snap = await col().where("uid", "==", assertSegment("uid", uid)).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

/**
 * Adds pieces to a person's Favourites (made if needed), up to its cap; the rest are dropped.
 * Used when a guest's Favourites join the account's at sign-in. Returns how many were added.
 */
export async function unionIntoFavourites(
  uid: string,
  itemIds: string[],
  now: Date = new Date(),
): Promise<number> {
  const ref = col().doc(favouritesIdFor(uid));
  return firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists
      ? (snap.data() as ListDoc)
      : blankFavourites(uid, false, now);
    const have = new Set(cur.itemIds);
    const next = [...cur.itemIds];
    let added = 0;
    for (const id of itemIds) {
      if (have.has(id) || next.length >= MAX_FAVOURITES) continue;
      have.add(id);
      next.push(id);
      added++;
    }
    if (!snap.exists || added > 0)
      tx.set(ref, {
        ...cur,
        itemIds: next,
        updatedAt: Timestamp.fromDate(now),
      });
    return added;
  });
}

/** A guest who has linked an account: their Favourites stop expiring. */
export async function clearGuestListExpiry(uid: string): Promise<number> {
  const snap = await col().where("uid", "==", assertSegment("uid", uid)).get();
  const stale = snap.docs.filter((d) => d.get("isGuest") === true);
  await Promise.all(
    stale.map((d) => d.ref.update({ isGuest: false, expiresAt: null })),
  );
  return stale.length;
}

// Lists: named lists of catalogue pieces. Signed-in people only; a guest gets 403 account_required.
// Every route answers 404 for a list that is not the caller's.
import { getItem } from "@trailroom/catalog";
import {
  MAX_LIST_NAME_LENGTH,
  changeListFor,
  createListFor,
  deleteListFor,
  favouritesIdFor,
  blankFavourites,
  isFavourites,
  getListFor,
  listListsForUser,
  revokeAsksForList,
  type ListWithId,
} from "@trailroom/db";
import { err, ok, type Result } from "./http";
import { hasControl, stripUnsafe } from "./text-clean";
import type { User } from "./auth";

export interface ListBody {
  id: string;
  name: string;
  /** "favourites" is the default list: it cannot be renamed or deleted. */
  kind?: "favourites";
  itemIds: string[];
  createdAt: string;
  updatedAt: string;
}

export const listBody = (l: ListWithId): ListBody => ({
  id: l.id,
  name: l.list.name,
  ...(isFavourites(l.list) ? { kind: "favourites" as const } : {}),
  itemIds: l.list.itemIds,
  createdAt: l.list.createdAt.toDate().toISOString(),
  updatedAt: l.list.updatedAt.toDate().toISOString(),
});

/** A trimmed name of 1 to 60 characters with no control characters, or null. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // Control characters refuse the name; bidi controls and the like are dropped from it.
  if (hasControl(raw.replace(/\s+/g, " "))) return null;
  const name = stripUnsafe(raw).replace(/\s+/g, " ").trim();
  if (name.length === 0 || name.length > MAX_LIST_NAME_LENGTH) return null;
  return name;
}

const validItem = (v: unknown): v is string =>
  typeof v === "string" && getItem(v) !== undefined;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function guard(user: User) {
  return user.isGuest ? err("account_required") : null;
}

/**
 * The person's lists with Favourites first. Before the first save Favourites is not stored yet:
 * it is shown empty under its permanent id, and the first save into that id creates it. A guest
 * has only Favourites.
 */
export async function getLists(
  user: User,
): Promise<Result<{ lists: ListBody[] }>> {
  const mine = await listListsForUser(user.uid);
  const fav =
    mine.find((l) => isFavourites(l.list)) ??
    ({
      id: favouritesIdFor(user.uid),
      list: blankFavourites(user.uid, user.isGuest),
    } satisfies ListWithId);
  const rest = mine.filter((l) => l.id !== fav.id);
  return ok({
    lists: [fav, ...(user.isGuest ? [] : rest)].map(listBody),
  });
}

export async function createList(
  user: User,
  body: unknown,
): Promise<Result<{ list: ListBody }>> {
  const g = guard(user);
  if (g) return g;
  if (!isObject(body)) return err("invalid_request");
  const name = cleanName(body.name);
  if (!name) return err("invalid_request");
  if (body.itemId !== undefined && !validItem(body.itemId))
    return err("invalid_request");
  const r = await createListFor(
    user.uid,
    name,
    body.itemId as string | undefined,
  );
  if (!r.ok)
    return err(r.error === "list_limit" ? "list_limit" : "invalid_request");
  return ok({ list: listBody(r.value) }, 201);
}

export async function changeList(
  user: User,
  rawId: string,
  body: unknown,
): Promise<Result<{ list: ListBody }>> {
  // "favourites" is the alias a client uses before it knows its own id (a first save).
  const id = rawId === "favourites" ? favouritesIdFor(user.uid) : rawId;
  // A guest may save to Favourites and nothing else.
  if (user.isGuest && id !== favouritesIdFor(user.uid))
    return err("account_required");
  if (!isObject(body)) return err("invalid_request");
  const change: { name?: string; add?: string; remove?: string } = {};
  if (body.name !== undefined) {
    const name = cleanName(body.name);
    if (!name) return err("invalid_request");
    change.name = name;
  }
  if (body.add !== undefined) {
    if (!validItem(body.add)) return err("invalid_request");
    change.add = body.add;
  }
  if (body.remove !== undefined) {
    if (typeof body.remove !== "string") return err("invalid_request");
    change.remove = body.remove;
  }
  if (Object.keys(change).length === 0) return err("invalid_request");
  const r = await changeListFor(user.uid, id, change, new Date(), user.isGuest);
  if (!r.ok) {
    if (r.error === "list_full") return err("list_full");
    if (r.error === "protected") return err("invalid_request");
    return err("not_found");
  }
  return ok({ list: listBody(r.value) });
}

/** Deleting a list revokes the live asks made from it. */
export async function deleteList(
  user: User,
  id: string,
): Promise<Result<{ deleted: true }>> {
  const g = guard(user);
  if (g) return g;
  const found = await getListFor(user.uid, id);
  if (!found) return err("not_found");
  if (isFavourites(found.list)) return err("invalid_request");
  await revokeAsksForList(user.uid, id);
  await deleteListFor(user.uid, id);
  return ok({ deleted: true as const });
}

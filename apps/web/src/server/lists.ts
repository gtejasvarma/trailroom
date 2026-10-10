// Lists: named lists of catalogue pieces. Signed-in people only; a guest gets 403 account_required.
// Every route answers 404 for a list that is not the caller's.
import { getItem } from "@trailroom/catalog";
import {
  MAX_LIST_NAME_LENGTH,
  changeListFor,
  createListFor,
  deleteListFor,
  getListFor,
  listListsForUser,
  revokeAsksForList,
  type ListWithId,
} from "@trailroom/db";
import { err, ok, type Result } from "./http";
import type { User } from "./auth";

export interface ListBody {
  id: string;
  name: string;
  itemIds: string[];
  createdAt: string;
  updatedAt: string;
}

export const listBody = (l: ListWithId): ListBody => ({
  id: l.id,
  name: l.list.name,
  itemIds: l.list.itemIds,
  createdAt: l.list.createdAt.toDate().toISOString(),
  updatedAt: l.list.updatedAt.toDate().toISOString(),
});

/** A trimmed name of 1 to 60 characters with no control characters, or null. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim();
  // eslint-disable-next-line no-control-regex
  if (
    name.length === 0 ||
    name.length > MAX_LIST_NAME_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(name)
  )
    return null;
  return name;
}

const validItem = (v: unknown): v is string =>
  typeof v === "string" && getItem(v) !== undefined;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function guard(user: User) {
  return user.isGuest ? err("account_required") : null;
}

export async function getLists(
  user: User,
): Promise<Result<{ lists: ListBody[] }>> {
  const g = guard(user);
  if (g) return g;
  return ok({ lists: (await listListsForUser(user.uid)).map(listBody) });
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
  id: string,
  body: unknown,
): Promise<Result<{ list: ListBody }>> {
  const g = guard(user);
  if (g) return g;
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
  const r = await changeListFor(user.uid, id, change);
  if (!r.ok) {
    if (r.error === "list_full") return err("list_full");
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
  if (!(await getListFor(user.uid, id))) return err("not_found");
  await revokeAsksForList(user.uid, id);
  await deleteListFor(user.uid, id);
  return ok({ deleted: true as const });
}

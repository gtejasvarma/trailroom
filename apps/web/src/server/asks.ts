// The asker's side: create an ask from one of their own lists, see their asks, revoke one.
// Creating an ask is the explicit act that lets people with the link see those renders. Nothing
// returned here names a voter, and the raw link token is returned once, by createAsk.
import { getItem } from "@trailroom/catalog";
import {
  MAX_ASK_ITEMS,
  MAX_QUESTION_LENGTH,
  auth,
  createAskFor,
  getListFor,
  getPoseSet,
  isAskLive,
  listAsksForUser,
  kindOf,
  listPoseSetsForUser,
  revokeAskFor,
  type AskWithId,
} from "@trailroom/db";
import { stripUnsafe } from "./text-clean";
import { err, ok, type Result } from "./http";
import type { User } from "./auth";

export type AskState = "live" | "revoked" | "expired";

export interface AskSummary {
  askId: string;
  listId: string;
  listName: string;
  question: string | null;
  itemIds: string[];
  /** Votes per piece. Counts only: never who voted. */
  counts: Record<string, number>;
  total: number;
  state: AskState;
  createdAt: string;
  expiresAt: string;
}

export function askState(
  a: AskWithId["ask"],
  now: Date = new Date(),
): AskState {
  if (a.revokedAt !== null) return "revoked";
  return isAskLive(a, now) ? "live" : "expired";
}

const summary = (a: AskWithId): AskSummary => ({
  askId: a.id,
  listId: a.ask.listId,
  listName: a.ask.listName,
  question: a.ask.question,
  itemIds: a.ask.itemIds,
  counts: a.ask.counts,
  total: Object.values(a.ask.counts).reduce((n, c) => n + c, 0),
  state: askState(a.ask),
  createdAt: a.ask.createdAt.toDate().toISOString(),
  expiresAt: a.ask.expiresAt.toDate().toISOString(),
});

/** First word of the display name, trimmed to something a header can hold. */
export function firstNameOf(displayName: string | undefined | null): string {
  const first =
    stripUnsafe(displayName ?? "")
      .replace(/[<>]/g, "")
      .trim()
      .split(/\s+/)[0] ?? "";
  return first.slice(0, 30) || "A friend";
}

export function cleanQuestion(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") return undefined;
  const q = stripUnsafe(raw, " ").replace(/\s+/g, " ").trim();
  if (q.length > MAX_QUESTION_LENGTH) return undefined;
  return q.length === 0 ? null : q;
}

/**
 * The absolute origin the browser used, honouring the proxy's forwarded headers only for hosts we
 * serve: INTERNAL_AUDIENCE plus the comma-separated PUBLIC_ORIGINS. Any other forwarded host
 * (a client can send its own) gives INTERNAL_AUDIENCE. With no INTERNAL_AUDIENCE (local dev,
 * tests) the forwarded headers are used as they come.
 */
export function originOf(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): string {
  const url = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    url.host;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    url.protocol.replace(":", "");
  const own = env.INTERNAL_AUDIENCE?.trim().replace(/\/+$/, "");
  if (!own) return `${proto}://${host}`;
  const allowed = [own, ...(env.PUBLIC_ORIGINS ?? "").split(",")]
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean)
    .flatMap((o) => {
      try {
        return [new URL(o)];
      } catch {
        return [];
      }
    });
  const forwarded = allowed.find(
    (o) => o.host === host && o.protocol === `${proto}:`,
  );
  return forwarded ? forwarded.origin : new URL(own).origin;
}

/** The asker's name as the vote page shows it. */
async function askerNameOf(user: User): Promise<string> {
  let displayName: string | undefined;
  try {
    // A guest who linked Google keeps an empty top-level name; the provider record has it.
    const record = await auth().getUser(user.uid);
    displayName =
      record.displayName ??
      record.providerData.find((p) => p.displayName)?.displayName;
  } catch {
    displayName = undefined;
  }
  return firstNameOf(displayName);
}

/**
 * An ask for one piece the person has tried on, with no list (the mirror's "Ask a friend"). The
 * try-on named by `poseSetId` is the one frozen into the ask, so what friends see is the very
 * render the person was looking at. Every other rule is the list ask's: an account only, the
 * 20-live-asks limit, the question rules, the token handled by createAskFor. The ask has no list:
 * its `listId` is empty and its `listName` (the vote page's title) is the piece's name.
 */
async function createPieceAsk(
  user: User,
  request: Request,
  poseSetId: string,
  question: string | null,
): Promise<Result<{ askId: string; url: string }>> {
  let found;
  try {
    found = await getPoseSet(poseSetId);
  } catch {
    // An id that is not a valid path segment is no one's try-on.
    return err("not_found");
  }
  if (
    !found ||
    found.uid !== user.uid ||
    kindOf(found) !== "tryon" ||
    (found.status !== "complete" && found.status !== "complete_partial")
  )
    return err("not_found");
  const item = getItem(found.itemId);
  // Friends are shown the Front render; a set without one has nothing to show.
  if (!item || !found.poses.includes("front")) return err("invalid_request");
  const r = await createAskFor({
    uid: user.uid,
    askerFirstName: await askerNameOf(user),
    listId: "",
    listName: item.name,
    question,
    itemIds: [item.id],
    poseSetIds: { [item.id]: poseSetId },
    poseSetJobIds: { [item.id]: found.jobId },
  });
  if (!r.ok) return err("ask_limit");
  return ok({ askId: r.id, url: `${originOf(request)}/ask/${r.token}` }, 201);
}

export async function createAsk(
  user: User,
  request: Request,
  body: unknown,
): Promise<Result<{ askId: string; url: string }>> {
  if (user.isGuest) return err("account_required");
  if (typeof body !== "object" || body === null) return err("invalid_request");
  const { listId, itemIds, question, poseSetId } = body as Record<
    string,
    unknown
  >;
  const q = cleanQuestion(question);
  if (q === undefined) return err("invalid_request");
  // One piece, no list: { poseSetId, question? }.
  if (listId === undefined && poseSetId !== undefined) {
    if (typeof poseSetId !== "string" || itemIds !== undefined)
      return err("invalid_request");
    return createPieceAsk(user, request, poseSetId, q);
  }
  if (typeof listId !== "string") return err("invalid_request");
  const list = await getListFor(user.uid, listId);
  if (!list) return err("not_found");
  if (
    !Array.isArray(itemIds) ||
    itemIds.length < 1 ||
    itemIds.length > MAX_ASK_ITEMS ||
    new Set(itemIds).size !== itemIds.length ||
    !itemIds.every(
      (i) =>
        typeof i === "string" && list.list.itemIds.includes(i) && getItem(i),
    )
  )
    return err("invalid_request");
  const ids = itemIds as string[];

  // Freeze the asker's finished try-on for each piece: the newest complete set with a Front.
  const sets = (await listPoseSetsForUser(user.uid)).reverse();
  const poseSetIds: Record<string, string | null> = {};
  const poseSetJobIds: Record<string, string | null> = {};
  for (const id of ids) {
    const found = sets.find(
      (s) =>
        s.poseSet.uid === user.uid &&
        kindOf(s.poseSet) === "tryon" &&
        s.poseSet.itemId === id &&
        (s.poseSet.status === "complete" ||
          s.poseSet.status === "complete_partial") &&
        s.poseSet.poses.includes("front"),
    );
    poseSetIds[id] = found?.id ?? null;
    poseSetJobIds[id] = found?.poseSet.jobId ?? null;
  }

  const r = await createAskFor({
    uid: user.uid,
    askerFirstName: await askerNameOf(user),
    listId: list.id,
    listName: list.list.name,
    question: q,
    itemIds: ids,
    poseSetIds,
    poseSetJobIds,
  });
  if (!r.ok) return err("ask_limit");
  return ok({ askId: r.id, url: `${originOf(request)}/ask/${r.token}` }, 201);
}

export async function getAsks(
  user: User,
): Promise<Result<{ asks: AskSummary[] }>> {
  if (user.isGuest) return err("account_required");
  return ok({ asks: (await listAsksForUser(user.uid)).map(summary) });
}

export async function revokeAsk(
  user: User,
  id: string,
): Promise<Result<{ revoked: true }>> {
  if (user.isGuest) return err("account_required");
  if (!(await revokeAskFor(user.uid, id))) return err("not_found");
  return ok({ revoked: true as const });
}

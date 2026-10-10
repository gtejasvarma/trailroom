// The public side of an ask: what the link reaches. No account, no gate. Everything is reached by
// the token's hash; garbage tokens never touch Firestore. Responses carry no uid, no voter
// identity, and are never cached or indexed.
import {
  castVote,
  getAskByToken,
  getVote,
  isAskLive,
  newVoterKey,
  openInboxAsk,
  setInboxVote,
  type AskWithId,
} from "@trailroom/db";
import { createAttemptLimiter, clientKey } from "../lib/gate-limit";
import { readVoterKey, voterCookie } from "../lib/voter-cookie";
import { askImage } from "./ask-image";
import { readCapped } from "./body";
import { buildAskView, type AskView } from "./ask-view";
import { err, ok, type Result } from "./http";
import { optionalUser, type User } from "./auth";

/**
 * Vote attempts per token and IP. In memory and per instance: it resets on a restart and is not
 * shared between instances, so it only slows a flood; Cloud Armor is the real rate limit.
 */
const voteLimiter = createAttemptLimiter(30, 10 * 60 * 1000);
const MAX_VOTE_BODY_BYTES = 512;
/** Public reads (page data and images) per client and token: a page shows up to 4 images. */
const readLimiter = createAttemptLimiter(240, 10 * 60 * 1000);
/** Requests whose token is not found, per client: slows random-token probing. */
const missLimiter = createAttemptLimiter(30, 10 * 60 * 1000);

/** True when this request is over a public limit; counts it against the read limit if not. */
export function publicReadLimited(token: string, headers: Headers): boolean {
  const client = clientKey(headers);
  const key = `${token.slice(0, 16)}|${client}`;
  if (missLimiter.blocked(client) || readLimiter.blocked(key)) return true;
  readLimiter.record(key);
  return false;
}

/** Counts a request for a token that was not found. */
export function recordPublicMiss(headers: Headers): void {
  missLimiter.record(clientKey(headers));
}

/** Headers on every public ask response (page data, votes and images). */
export const PUBLIC_ASK_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
} as const;

/** A voter with an account votes under their uid; everyone else under the cookie's random key. */
const accountOf = (u: User | null): User | null => (u && !u.isGuest ? u : null);

type Found = { found: AskWithId } | { error: Result<never> };

async function liveAsk(token: string, headers: Headers): Promise<Found> {
  const found = await getAskByToken(token);
  if (!found) {
    recordPublicMiss(headers);
    return { error: err("not_found") };
  }
  if (!isAskLive(found.ask)) return { error: err("ask_closed") };
  return { found };
}

/** GET /api/ask/[token]. A signed-in viewer's first open adds the ask to their inbox. */
export async function getPublicAsk(
  token: string,
  request: Request,
): Promise<Result<AskView>> {
  if (publicReadLimited(token, request.headers))
    return err("too_many_attempts");
  const r = await liveAsk(token, request.headers);
  if ("error" in r) return r.error as Result<AskView>;
  const { id, ask } = r.found;
  const viewer = accountOf(await optionalUser(request));
  const isAsker = viewer?.uid === ask.uid;
  const key = viewer ? viewer.uid : readVoterKey(request.headers.get("cookie"));
  const mine = key && !isAsker ? await getVote(id, key) : null;
  if (viewer && !isAsker) {
    await openInboxAsk(viewer.uid, id, ask, mine?.itemId ?? null);
  }
  return ok(
    await buildAskView(ask, {
      imageBase: `/api/ask/${token}/image`,
      myVote: mine?.itemId ?? null,
      isAsker,
    }),
  );
}

/** POST /api/ask/[token]/vote { itemId }. Returns the response and, for a new voter, a cookie. */
export async function voteOnAsk(
  token: string,
  request: Request,
  secure: boolean,
): Promise<{ result: Result<AskView>; setCookie?: string }> {
  const bad = (code: Parameters<typeof err>[0]) => ({
    result: err(code) as Result<AskView>,
  });
  // Only our own page may post a vote: JSON (which a plain cross-site form cannot send) and not
  // from another site's page. A missing Sec-Fetch-Site is allowed, for non-browser clients.
  if (
    !(request.headers.get("content-type") ?? "")
      .toLowerCase()
      .startsWith("application/json") ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    return bad("invalid_request");
  const limitKey = `${token.slice(0, 16)}|${clientKey(request.headers)}`;
  if (
    voteLimiter.blocked(limitKey) ||
    missLimiter.blocked(clientKey(request.headers))
  )
    return bad("too_many_attempts");
  voteLimiter.recordFailure(limitKey);

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_VOTE_BODY_BYTES) return bad("body_too_large");
  const raw = await readCapped(request.body, MAX_VOTE_BODY_BYTES).catch(() =>
    Buffer.alloc(0),
  );
  if (raw === null) return bad("body_too_large");
  let itemId: unknown;
  try {
    itemId = (JSON.parse(raw.toString("utf8")) as { itemId?: unknown }).itemId;
  } catch {
    return bad("invalid_request");
  }
  if (typeof itemId !== "string") return bad("invalid_request");

  const r = await liveAsk(token, request.headers);
  if ("error" in r) return { result: r.error as Result<AskView> };
  const { id, ask } = r.found;
  if (!ask.itemIds.includes(itemId)) return bad("invalid_request");

  const viewer = accountOf(await optionalUser(request));
  if (viewer?.uid === ask.uid) return bad("own_ask");
  const existingKey = viewer
    ? viewer.uid
    : readVoterKey(request.headers.get("cookie"));
  const key = existingKey ?? newVoterKey();

  const cast = await castVote(id, key, viewer?.uid ?? null, itemId);
  if (!cast.ok)
    return bad(
      cast.error === "closed"
        ? "ask_closed"
        : cast.error === "full"
          ? "ask_full"
          : "invalid_request",
    );
  if (viewer) {
    await openInboxAsk(viewer.uid, id, ask, itemId);
    await setInboxVote(viewer.uid, id, itemId);
  }
  const view = await buildAskView(
    { ...ask, counts: cast.counts },
    { imageBase: `/api/ask/${token}/image`, myVote: itemId, isAsker: false },
  );
  return {
    result: ok(view),
    setCookie: existingKey ? undefined : voterCookie(key, secure),
  };
}

/** GET /api/ask/[token]/image/[itemId]. */
export async function getPublicAskImage(
  token: string,
  itemId: string,
  headers: Headers = new Headers(),
): Promise<
  Result<{ bytes: Buffer; contentType: string; source: "render" | "label" }>
> {
  if (publicReadLimited(token, headers)) return err("too_many_attempts");
  const r = await liveAsk(token, headers);
  // A closed link serves no image at all, and does not say why: 404, like an unknown one.
  if ("error" in r) return err("not_found");
  return askImage(r.found.ask, itemId);
}

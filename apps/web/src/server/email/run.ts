// The email step of the follow loop, run from the scheduled housekeeping call. With the transport
// `none` it returns at once and touches nothing: no reads, no keys, nothing recorded as sent.
//
// New-arrival email (PRD 12, 21.3): batched (one message lists everything new from the labels the
// person follows since they switched it on) and capped (at most one a day per person). Price-change
// email: the same shape for pieces in their lists. Each event reaches each person at most once: a
// key per (person, event) is claimed in a transaction BEFORE the message goes out, and given back
// only if the transport refuses it. The "one a day" mark is written before the message too (see
// `deliver`). One person's failure is logged and skipped; it never stops the others.
import { getItem } from "@trailroom/catalog";
import {
  auth,
  claimEmailEvents,
  createEmailToken,
  getEmailPrefs,
  getFollows,
  listEventsSince,
  listListsForUser,
  listUidsWith,
  recordEmailSent,
  releaseEmailEvents,
  type EmailKind,
  type EmailPrefsDoc,
} from "@trailroom/db";
import { loadPublishedCatalog } from "@trailroom/pipeline";
import { logError } from "@trailroom/render";
import {
  newArrivalsEmail,
  priceChangeEmail,
  type NewsPiece,
  type PriceChange,
} from "./templates";
import { emailTransport, type EmailTransport } from "./transport";

/** Events older than this are never sent, however late a person switches a kind on. */
export const EVENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** One message of each kind per person per day. */
export const DAILY_GAP_MS = 24 * 60 * 60 * 1000;

export interface EmailRunResult {
  /** The transport in use ("none" means the whole step was skipped). */
  transport: string;
  news: number;
  price: number;
}

async function addressOf(uid: string): Promise<string | null> {
  try {
    const u = await auth().getUser(uid);
    if (
      u.disabled ||
      !u.email ||
      !u.emailVerified ||
      u.providerData.length === 0
    )
      return null;
    return u.email;
  } catch {
    return null;
  }
}

const sinceOf = (prefs: EmailPrefsDoc, kind: EmailKind, now: Date): Date => {
  const on = (kind === "news" ? prefs.newsSince : prefs.priceSince)?.toDate();
  const floor = new Date(now.getTime() - EVENT_WINDOW_MS);
  return on && on > floor ? on : floor;
};

const tooSoon = (prefs: EmailPrefsDoc, kind: EmailKind, now: Date): boolean => {
  const last = (
    kind === "news" ? prefs.lastNewsAt : prefs.lastPriceAt
  )?.toDate();
  return Boolean(last && now.getTime() - last.getTime() < DAILY_GAP_MS);
};

async function deliver(
  transport: EmailTransport,
  uid: string,
  kind: EmailKind,
  eventIds: string[],
  /** Builds the message from the events THIS call claimed: an event already sent is never repeated. */
  build: (
    claimed: string[],
    to: string,
    unsubscribeUrl: string,
  ) => ReturnType<typeof newArrivalsEmail>,
  origin: string,
  now: Date,
  /** The "one a day" mark as it was before this call, to put back if the message does not go. */
  previousMark: Date | null,
): Promise<boolean> {
  const to = await addressOf(uid);
  if (!to) return false;
  const claimed = await claimEmailEvents(uid, kind, eventIds, now);
  if (claimed.length === 0) return false;
  // The "one a day" mark is written BEFORE the message goes out, with the event keys. The other
  // order (send, then mark) loses the mark if the write after a successful send fails, and the
  // next run would then send a second message the same day. Written first, the worst case is
  // reversed: if the send fails and the mark cannot be put back, the person simply gets nothing
  // until tomorrow. If the mark itself cannot be written, nothing is sent and the keys go back.
  try {
    await recordEmailSent(uid, kind, now);
  } catch (e) {
    logError(`email (${kind}) not sent: could not record it`, e);
    await releaseEmailEvents(uid, claimed).catch(() => undefined);
    return false;
  }
  try {
    const token = await createEmailToken(uid, now);
    await transport.send(build(claimed, to, `${origin}/unsubscribe/${token}`));
  } catch (e) {
    logError(`email (${kind}) not sent`, e);
    await releaseEmailEvents(uid, claimed).catch(() => undefined);
    await recordEmailSent(uid, kind, previousMark).catch(() => undefined);
    return false;
  }
  return true;
}

export async function runEmail(
  now: Date,
  origin: string,
  env: Record<string, string | undefined> = process.env,
): Promise<EmailRunResult> {
  const transport = emailTransport(env);
  const result: EmailRunResult = {
    transport: transport.name,
    news: 0,
    price: 0,
  };
  if (!transport.canSend) return result;
  await loadPublishedCatalog();
  const floor = new Date(now.getTime() - EVENT_WINDOW_MS);

  // New arrivals.
  try {
    const events = await listEventsSince("new_piece", floor);
    if (events.length > 0) {
      for (const uid of await listUidsWith("news")) {
        try {
          const prefs = await getEmailPrefs(uid);
          if (!prefs?.news || tooSoon(prefs, "news", now)) continue;
          const follows = new Set(await getFollows(uid));
          const since = sinceOf(prefs, "news", now);
          const mine = events.filter(
            (e) =>
              follows.has(e.event.labelSlug) &&
              e.event.createdAt.toDate() >= since &&
              getItem(e.event.itemId),
          );
          if (mine.length === 0) continue;
          const piecesFor = (claimed: string[]): NewsPiece[] =>
            [...mine]
              .reverse() // newest first
              .filter((e) => claimed.includes(e.id))
              .map((e) => getItem(e.event.itemId)!)
              .map((i) => ({
                id: i.id,
                name: i.name,
                label: i.label,
                priceUsd: i.priceUsd,
              }));
          if (
            await deliver(
              transport,
              uid,
              "news",
              mine.map((e) => e.id),
              (claimed, to, unsub) =>
                newArrivalsEmail(to, piecesFor(claimed), origin, unsub),
              origin,
              now,
              prefs.lastNewsAt?.toDate() ?? null,
            )
          ) {
            result.news++;
          }
        } catch (e) {
          logError("email: a person's new-arrival email failed", e);
        }
      }
    }
  } catch (e) {
    logError("email: new arrivals failed", e);
  }

  // Price changes on pieces in a person's lists.
  try {
    const events = await listEventsSince("price_change", floor);
    if (events.length > 0) {
      for (const uid of await listUidsWith("price")) {
        try {
          const prefs = await getEmailPrefs(uid);
          if (!prefs?.price || tooSoon(prefs, "price", now)) continue;
          const listed = new Set(
            (await listListsForUser(uid)).flatMap((l) => l.list.itemIds),
          );
          const since = sinceOf(prefs, "price", now);
          const mine = events.filter(
            (e) =>
              listed.has(e.event.itemId) &&
              e.event.createdAt.toDate() >= since &&
              getItem(e.event.itemId) &&
              e.event.oldPriceUsd !== undefined &&
              e.event.newPriceUsd !== undefined,
          );
          if (mine.length === 0) continue;
          const changesFor = (claimed: string[]): PriceChange[] =>
            mine
              .filter((e) => claimed.includes(e.id))
              .map((e) => ({
                id: e.event.itemId,
                name: getItem(e.event.itemId)!.name,
                oldPriceUsd: e.event.oldPriceUsd!,
                newPriceUsd: e.event.newPriceUsd!,
              }));
          if (
            await deliver(
              transport,
              uid,
              "price",
              mine.map((e) => e.id),
              (claimed, to, unsub) =>
                priceChangeEmail(to, changesFor(claimed), origin, unsub),
              origin,
              now,
              prefs.lastPriceAt?.toDate() ?? null,
            )
          ) {
            result.price++;
          }
        } catch (e) {
          logError("email: a person's price-change email failed", e);
        }
      }
    }
  } catch (e) {
    logError("email: price changes failed", e);
  }
  return result;
}

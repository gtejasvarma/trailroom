// Everything held about a person for email: preferences, the once-per-event keys, and the
// unsubscribe tokens. Server-only. The address itself is never stored here: it is read from the
// sign-in record when a message is sent.
import { createHash, randomBytes } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "./app";
import { assertSegment } from "./paths";

export type EmailKind = "news" | "price";

export interface EmailPrefsDoc {
  news: boolean;
  price: boolean;
  /** When the last message of each kind went out: the once-a-day cap reads these. */
  lastNewsAt?: Timestamp | null;
  lastPriceAt?: Timestamp | null;
  /** When each kind was last switched on: events from before then are never sent. */
  newsSince?: Timestamp | null;
  priceSince?: Timestamp | null;
  updatedAt: Timestamp;
}

const prefs = () => firestore().collection("emailPrefs");
const sent = () => firestore().collection("emailSent");
const tokens = () => firestore().collection("emailTokens");

/** Nobody has an email preference until they set one: no document means no email. */
export async function getEmailPrefs(
  uid: string,
): Promise<EmailPrefsDoc | null> {
  const snap = await prefs().doc(assertSegment("uid", uid)).get();
  return snap.exists ? (snap.data() as EmailPrefsDoc) : null;
}

export async function setEmailPrefs(
  uid: string,
  patch: Partial<Pick<EmailPrefsDoc, "news" | "price">>,
  now: Date = new Date(),
): Promise<EmailPrefsDoc> {
  const r = prefs().doc(assertSegment("uid", uid));
  const at = Timestamp.fromDate(now);
  await firestore().runTransaction(async (tx) => {
    const before = (await tx.get(r)).data() as
      Partial<EmailPrefsDoc> | undefined;
    tx.set(
      r,
      {
        ...(patch.news !== undefined ? { news: patch.news } : {}),
        ...(patch.price !== undefined ? { price: patch.price } : {}),
        // Switching a kind on starts its clock: what happened before is not sent.
        ...(patch.news === true && before?.news !== true
          ? { newsSince: at }
          : {}),
        ...(patch.price === true && before?.price !== true
          ? { priceSince: at }
          : {}),
        updatedAt: at,
      },
      { merge: true },
    );
  });
  const cur = (await r.get()).data() as Partial<EmailPrefsDoc>;
  return {
    ...cur,
    news: cur.news === true,
    price: cur.price === true,
    updatedAt: cur.updatedAt ?? Timestamp.fromDate(now),
  };
}

/** Uids that switched a kind on (bounded), for the email step to walk. */
export async function listUidsWith(
  kind: EmailKind,
  limit = 500,
): Promise<string[]> {
  const snap = await prefs().where(kind, "==", true).limit(limit).get();
  return snap.docs.map((d) => d.id);
}

export async function recordEmailSent(
  uid: string,
  kind: EmailKind,
  now: Date = new Date(),
): Promise<void> {
  await prefs()
    .doc(assertSegment("uid", uid))
    .set(
      kind === "news"
        ? { lastNewsAt: Timestamp.fromDate(now) }
        : { lastPriceAt: Timestamp.fromDate(now) },
      { merge: true },
    );
}

const sentId = (uid: string, eventId: string) =>
  `${assertSegment("uid", uid)}_${assertSegment("eventId", eventId)}`;

/**
 * Claims the once-per-event keys for these events, in one transaction, and returns the event ids
 * this call claimed. An event that already has a key (sent, or being sent) is left out, so the same
 * event never reaches the same person twice.
 */
export async function claimEmailEvents(
  uid: string,
  kind: EmailKind,
  eventIds: readonly string[],
  now: Date = new Date(),
): Promise<string[]> {
  if (eventIds.length === 0) return [];
  const refs = eventIds.map((e) => sent().doc(sentId(uid, e)));
  return firestore().runTransaction(async (tx) => {
    const snaps = await tx.getAll(...refs);
    const claimed: string[] = [];
    snaps.forEach((s, i) => {
      if (s.exists) return;
      tx.create(refs[i]!, {
        uid,
        eventId: eventIds[i],
        kind,
        claimedAt: Timestamp.fromDate(now),
      });
      claimed.push(eventIds[i]!);
    });
    return claimed;
  });
}

export async function hasEmailKey(
  uid: string,
  eventId: string,
): Promise<boolean> {
  return (await sent().doc(sentId(uid, eventId)).get()).exists;
}

/** Gives keys back when the transport refused the message, so a later run can try again. */
export async function releaseEmailEvents(
  uid: string,
  eventIds: readonly string[],
): Promise<void> {
  const batch = firestore().batch();
  for (const e of eventIds) batch.delete(sent().doc(sentId(uid, e)));
  await batch.commit();
}

// ---- Unsubscribe tokens: 256 random bits, only the SHA-256 stored (like the ask token) ----

export const EMAIL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const isEmailTokenShape = (t: unknown): t is string =>
  typeof t === "string" && EMAIL_TOKEN_PATTERN.test(t);
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

/** A fresh token for one message. The raw value goes into the link and nowhere else. */
export async function createEmailToken(
  uid: string,
  now: Date = new Date(),
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await tokens()
    .doc(hashToken(token))
    .create({
      uid: assertSegment("uid", uid),
      createdAt: Timestamp.fromDate(now),
    });
  return token;
}

/**
 * Switches every email kind off for whoever the token belongs to. Returns nothing at all about
 * whether the token existed: a caller cannot use this to learn that an address or a token is real.
 */
export async function unsubscribeByToken(
  token: string,
  now: Date = new Date(),
): Promise<void> {
  if (!isEmailTokenShape(token)) return;
  const snap = await tokens().doc(hashToken(token)).get();
  if (!snap.exists) return;
  const uid = String(snap.get("uid"));
  await prefs()
    .doc(uid)
    .set(
      { news: false, price: false, updatedAt: Timestamp.fromDate(now) },
      { merge: true },
    );
}

/** Tokens this old stop working (400 days: longer than anyone keeps an email). */
export async function deleteOldEmailTokens(cutoff: Date): Promise<number> {
  let n = 0;
  for (;;) {
    const snap = await tokens()
      .where("createdAt", "<", Timestamp.fromDate(cutoff))
      .limit(400)
      .get();
    if (snap.empty) return n;
    const batch = firestore().batch();
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();
    n += snap.size;
  }
}

/** Sent keys this old are no longer read (events older than a week are not considered). */
export async function deleteOldEmailKeys(cutoff: Date): Promise<number> {
  let n = 0;
  for (;;) {
    const snap = await sent()
      .where("claimedAt", "<", Timestamp.fromDate(cutoff))
      .limit(400)
      .get();
    if (snap.empty) return n;
    const batch = firestore().batch();
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();
    n += snap.size;
  }
}

/** Everything email holds about a person: preferences, keys, tokens. */
export async function deleteEmailDataForUser(uid: string): Promise<void> {
  assertSegment("uid", uid);
  const db = firestore();
  for (const col of [sent(), tokens()]) {
    for (;;) {
      const snap = await col.where("uid", "==", uid).limit(400).get();
      if (snap.empty) break;
      const batch = db.batch();
      for (const d of snap.docs) batch.delete(d.ref);
      await batch.commit();
    }
  }
  await prefs().doc(uid).delete();
}

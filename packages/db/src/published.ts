// The Firestore layer of the catalogue: pieces published without a back office, and the events
// the follow loop reads (a piece arrived, a price moved). Server-only: the rules deny clients.
// The piece itself is stored as plain data and checked by @trailroom/pipeline (published-catalog)
// before it is written and before it is trusted again, so this package needs no catalogue types.
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "./app";
import { assertSegment } from "./paths";

export type PieceData = Record<string, unknown>;

export interface PublishedPieceDoc {
  labelSlug: string;
  piece: PieceData;
  publishedAt: Timestamp;
  updatedAt: Timestamp;
}

export type PublishEventType = "new_piece" | "price_change";

export interface PublishEventDoc {
  type: PublishEventType;
  itemId: string;
  labelSlug: string;
  oldPriceUsd?: number;
  newPriceUsd?: number;
  createdAt: Timestamp;
}

const pieces = () => firestore().collection("publishedPieces");
const events = () => firestore().collection("publishEvents");

/** Pieces are listed this many at most; a library this small needs no paging yet. */
export const MAX_PUBLISHED_PIECES = 300;

export async function listPublishedPieces(): Promise<
  { id: string; doc: PublishedPieceDoc }[]
> {
  const snap = await pieces()
    .orderBy("publishedAt", "desc")
    .limit(MAX_PUBLISHED_PIECES)
    .get();
  return snap.docs.map((d) => ({
    id: d.id,
    doc: d.data() as PublishedPieceDoc,
  }));
}

export async function getPublishedPiece(
  id: string,
): Promise<PublishedPieceDoc | null> {
  const snap = await pieces().doc(assertSegment("itemId", id)).get();
  return snap.exists ? (snap.data() as PublishedPieceDoc) : null;
}

/** Creates the piece and its "new_piece" event together. False when the id is already taken. */
export async function createPublishedPiece(
  id: string,
  labelSlug: string,
  piece: PieceData,
  now: Date = new Date(),
): Promise<{ created: boolean; eventId?: string }> {
  const ref = pieces().doc(assertSegment("itemId", id));
  const evRef = events().doc();
  return firestore().runTransaction(async (tx) => {
    if ((await tx.get(ref)).exists) return { created: false };
    const at = Timestamp.fromDate(now);
    tx.create(ref, {
      labelSlug,
      piece,
      publishedAt: at,
      updatedAt: at,
    } satisfies PublishedPieceDoc);
    tx.create(evRef, {
      type: "new_piece",
      itemId: id,
      labelSlug,
      createdAt: at,
    } satisfies PublishEventDoc);
    return { created: true, eventId: evRef.id };
  });
}

/** Changes a published piece's price and records the event. Null when there is no such piece or no change. */
export async function changePublishedPrice(
  id: string,
  newPriceUsd: number,
  now: Date = new Date(),
): Promise<{ eventId: string; oldPriceUsd: number } | null> {
  const ref = pieces().doc(assertSegment("itemId", id));
  const evRef = events().doc();
  return firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const doc = snap.data() as PublishedPieceDoc;
    const old = Number(doc.piece.priceUsd);
    if (!Number.isFinite(old) || old === newPriceUsd) return null;
    const at = Timestamp.fromDate(now);
    tx.update(ref, {
      piece: { ...doc.piece, priceUsd: newPriceUsd },
      updatedAt: at,
    });
    tx.create(evRef, {
      type: "price_change",
      itemId: id,
      labelSlug: doc.labelSlug,
      oldPriceUsd: old,
      newPriceUsd,
      createdAt: at,
    } satisfies PublishEventDoc);
    return { eventId: evRef.id, oldPriceUsd: old };
  });
}

export interface EventWithId {
  id: string;
  event: PublishEventDoc;
}

/** Events of one type since `since`, oldest first. */
export async function listEventsSince(
  type: PublishEventType,
  since: Date,
  limit = 100,
): Promise<EventWithId[]> {
  const snap = await events()
    .where("type", "==", type)
    .where("createdAt", ">=", Timestamp.fromDate(since))
    .orderBy("createdAt", "asc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({
    id: d.id,
    event: d.data() as PublishEventDoc,
  }));
}

/** Events older than the cutoff go (the follow loop only reads recent ones). */
export async function deleteOldEvents(cutoff: Date): Promise<number> {
  let n = 0;
  for (;;) {
    const snap = await events()
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

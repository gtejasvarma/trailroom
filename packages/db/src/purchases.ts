// purchases/{uid}_{itemId}: the record that someone pressed "Go to <label>" on a piece, and later
// whether it arrived. The labels are invented, so nothing is bought: this is the intent and the
// answer, kept to learn whether the render was honest. Server-only (the rules deny clients).
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "./app";
import { assertSegment } from "./paths";
import type { PurchaseDoc } from "./types";

const col = () => firestore().collection("purchases");

/** The document id: one record per person and piece. */
export function purchaseId(uid: string, itemId: string): string {
  return assertSegment(
    "purchaseId",
    `${assertSegment("uid", uid)}_${assertSegment("itemId", itemId)}`,
  );
}

/** Records the intent once. A second press leaves the first record (and any answer) as it is. */
export async function recordPurchaseIntent(
  uid: string,
  itemId: string,
  now: Date = new Date(),
): Promise<{ purchase: PurchaseDoc; created: boolean }> {
  const ref = col().doc(purchaseId(uid, itemId));
  return firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists)
      return { purchase: snap.data() as PurchaseDoc, created: false };
    const purchase: PurchaseDoc = {
      uid,
      itemId,
      clickedAt: Timestamp.fromDate(now),
      arrived: null,
    };
    tx.create(ref, purchase);
    return { purchase, created: true };
  });
}

export async function getPurchase(
  uid: string,
  itemId: string,
): Promise<PurchaseDoc | null> {
  const snap = await col().doc(purchaseId(uid, itemId)).get();
  if (!snap.exists) return null;
  const doc = snap.data() as PurchaseDoc;
  return doc.uid === uid ? doc : null;
}

export async function listPurchasesForUser(
  uid: string,
): Promise<PurchaseDoc[]> {
  const snap = await col().where("uid", "==", assertSegment("uid", uid)).get();
  return snap.docs
    .map((d) => d.data() as PurchaseDoc)
    .sort((a, b) => a.clickedAt.toMillis() - b.clickedAt.toMillis());
}

export type AnswerResult =
  | { status: "answered"; purchase: PurchaseDoc }
  | { status: "already"; purchase: PurchaseDoc }
  | { status: "missing" };

/** Stores "did it arrive" once. An answered record is never changed. */
export async function answerPurchase(
  uid: string,
  itemId: string,
  arrived: boolean,
  now: Date = new Date(),
): Promise<AnswerResult> {
  const ref = col().doc(purchaseId(uid, itemId));
  return firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { status: "missing" } as const;
    const doc = snap.data() as PurchaseDoc;
    if (doc.arrived !== null)
      return { status: "already", purchase: doc } as const;
    const next: PurchaseDoc = {
      ...doc,
      arrived,
      answeredAt: Timestamp.fromDate(now),
    };
    tx.update(ref, { arrived, answeredAt: next.answeredAt });
    return { status: "answered", purchase: next } as const;
  });
}

export async function deletePurchasesForUser(uid: string): Promise<void> {
  const snap = await col().where("uid", "==", assertSegment("uid", uid)).get();
  const db = firestore();
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref);
    await batch.commit();
  }
}

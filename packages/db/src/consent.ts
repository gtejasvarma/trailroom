import { Timestamp } from "firebase-admin/firestore";
import { GUEST_TTL_MS } from "./types";
import { assertSegment } from "./paths";
import { firestore } from "./app";
import type { ConsentDoc } from "./types";

export async function recordConsent(
  uid: string,
  version: string,
): Promise<ConsentDoc> {
  const doc: ConsentDoc = {
    version,
    acceptedAt: Timestamp.now(),
    ageAttested18: true,
  };
  await firestore()
    .collection("consents")
    .doc(assertSegment("uid", uid))
    .set(doc);
  return doc;
}

export async function getConsent(uid: string): Promise<ConsentDoc | null> {
  const snap = await firestore()
    .collection("consents")
    .doc(assertSegment("uid", uid))
    .get();
  return snap.exists ? (snap.data() as ConsentDoc) : null;
}

/** True only when the consent on file was accepted under exactly this version. */
export async function isConsentCurrent(
  uid: string,
  version: string,
): Promise<boolean> {
  return (await getConsent(uid))?.version === version;
}

/**
 * Uids whose consent is older than the guest TTL and who have no photo doc: they consented and
 * never uploaded. Bounded by `limit` candidates (and a page cap); the caller must still check
 * that the Auth user is anonymous before deleting anything.
 */
export async function listStaleConsentUids(
  now: Date = new Date(),
  limit = 200,
): Promise<string[]> {
  const db = firestore();
  const cutoff = Timestamp.fromMillis(now.getTime() - GUEST_TTL_MS);
  const out: string[] = [];
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (let page = 0; page < 10 && out.length < limit; page++) {
    let q = db
      .collection("consents")
      .where("acceptedAt", "<", cutoff)
      .orderBy("acceptedAt", "asc")
      .limit(200);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    last = snap.docs[snap.docs.length - 1];
    const photos = await db.getAll(
      ...snap.docs.map((d) => db.collection("photos").doc(d.id)),
    );
    photos.forEach((p, i) => {
      if (!p.exists && out.length < limit) out.push(snap.docs[i]!.id);
    });
    if (snap.size < 200) break;
  }
  return out;
}

export async function deleteConsent(uid: string): Promise<void> {
  await firestore()
    .collection("consents")
    .doc(assertSegment("uid", uid))
    .delete();
}

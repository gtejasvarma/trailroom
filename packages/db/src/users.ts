import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "./app";
import { assertSegment } from "./paths";
import { deleteAllPhotoDocs } from "./photos";
import {
  deleteAllPhotoObjects,
  deleteRendersForUser,
  deleteStagingForJob,
} from "./storage";

const BATCH_LIMIT = 400;

async function commitDeletes(refs: FirebaseFirestore.DocumentReference[]) {
  const db = firestore();
  for (let i = 0; i < refs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const r of refs.slice(i, i + BATCH_LIMIT)) batch.delete(r);
    await batch.commit();
  }
}

/**
 * Removes everything held for a user: photo and renders objects, staging for their jobs, and the
 * consent, photo, job, jobInternals and poseSet docs. Other users' data is untouched. It leaves
 * usage/{uid}_{day} alone on purpose, so deleting data cannot reset a daily limit.
 * Objects are deleted again after the docs, to catch anything a racing render or upload wrote
 * while this ran.
 */
export async function deleteAllForUser(uid: string): Promise<void> {
  assertSegment("uid", uid);
  const db = firestore();
  const jobs = await db.collection("jobs").where("uid", "==", uid).get();
  const deleteObjects = async () => {
    for (const j of jobs.docs) await deleteStagingForJob(j.id);
    await deleteAllPhotoObjects(uid);
    await deleteRendersForUser(uid);
  };
  await deleteObjects();
  await deleteAllPhotoDocs(uid);
  const sets = await db.collection("poseSets").where("uid", "==", uid).get();
  await commitDeletes([
    ...jobs.docs.map((d) => d.ref),
    ...jobs.docs.map((d) => db.collection("jobInternals").doc(d.id)),
    ...sets.docs.map((d) => d.ref),
    db.collection("consents").doc(uid),
    db.collection("follows").doc(uid),
  ]);
  await deleteAllPhotoDocs(uid);
  await deleteObjects();
}

/**
 * A guest has linked a real account: their records stop expiring. Updates every photo, jobs and
 * pose sets for the uid; returns how many docs changed.
 */
export async function promoteGuest(uid: string): Promise<number> {
  assertSegment("uid", uid);
  const db = firestore();
  const photo = db.collection("photos").doc(uid);
  const [jobs, sets, photoSnap, items] = await Promise.all([
    db.collection("jobs").where("uid", "==", uid).get(),
    db.collection("poseSets").where("uid", "==", uid).get(),
    photo.get(),
    photo.collection("items").get(),
  ]);
  const batch = db.batch();
  let n = 0;
  if (photoSnap.exists) {
    batch.update(photo, { isGuest: false, expiresAt: null });
    n++;
  }
  for (const d of items.docs) {
    batch.update(d.ref, { isGuest: false, expiresAt: null });
    n++;
  }
  for (const d of jobs.docs) {
    batch.update(d.ref, { isGuest: false, expiresAt: null });
    n++;
  }
  for (const d of sets.docs) {
    batch.update(d.ref, { expiresAt: null });
    n++;
  }
  if (n > 0) await batch.commit();
  return n;
}

/**
 * Uids of guests whose records are at or past `expiresAt`, from photos and jobs (a guest with a
 * photo but no job counts). Signed-in users carry `isGuest: false, expiresAt: null` and never
 * match. At most `limit` uids, oldest first per collection.
 */
export async function listExpiredGuestUids(
  now: Date = new Date(),
  limit = 200,
): Promise<string[]> {
  const db = firestore();
  const cutoff = Timestamp.fromDate(now);
  const uids = new Set<string>();
  for (const name of ["photos", "jobs"] as const) {
    const snap = await db
      .collection(name)
      .where("isGuest", "==", true)
      .where("expiresAt", "<=", cutoff)
      .orderBy("expiresAt", "asc")
      .limit(limit)
      .get();
    for (const d of snap.docs) {
      // photos/{uid} is keyed by uid; jobs carry it as a field.
      uids.add(name === "photos" ? d.id : String(d.get("uid")));
    }
  }
  return [...uids].slice(0, limit);
}

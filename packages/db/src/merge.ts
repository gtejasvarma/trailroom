// Moves a guest's finished try-ons, photos, consent and follows into the account the same person
// has just signed into. Copy first, delete last: every step before the deletes is safe to repeat,
// and a run that dies part-way leaves the guest's data intact for a retry (or the purge).
// Only the two uids named are ever read or written.
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { auth, bucket, firestore } from "./app";
import { getConsent } from "./consent";
import { assertSegment, photoPath, renderPath } from "./paths";
import { poseSetIdFor } from "./poseSets";
import {
  deletePhotoObject,
  deleteRendersForPoseSet,
  deleteStagingForJob,
} from "./storage";
import {
  MAX_PHOTOS,
  type ConsentDoc,
  type FollowsDoc,
  type JobDoc,
  type PhotoDoc,
  type PhotosDoc,
  type PoseSetDoc,
} from "./types";

export interface MergeResult {
  photos: number;
  tryOns: { jobId: string; poseSetId: string; itemId: string }[];
  follows: number;
  /**
   * What stayed with the guest: photos over the account's cap, and try-ons still rendering (or
   * whose photo stayed). When either is above zero the guest sign-in is kept, so the 48-hour
   * purge removes it with what it holds.
   */
  stayed: { photos: number; tryOns: number };
}

const isCode = (e: unknown, ...codes: (number | string)[]) =>
  codes.includes((e as { code?: number | string }).code as never);
const alreadyExists = (e: unknown) =>
  isCode(e, 6, "already-exists", "ALREADY_EXISTS");

async function copyObject(from: string, to: string): Promise<boolean> {
  try {
    await bucket().file(from).copy(bucket().file(to));
    return true;
  } catch (e) {
    if (isCode(e, 404)) return false;
    throw e;
  }
}

const FINISHED = ["complete", "complete_partial"];
const ms = (t: Timestamp) => t.toMillis();

export async function mergeGuestInto(
  guestUid: string,
  accountUid: string,
): Promise<MergeResult> {
  assertSegment("uid", guestUid);
  assertSegment("uid", accountUid);
  if (guestUid === accountUid)
    throw new Error("cannot merge a user into itself");
  const db = firestore();
  const result: MergeResult = {
    photos: 0,
    tryOns: [],
    follows: 0,
    stayed: { photos: 0, tryOns: 0 },
  };

  const guestItems = db.collection("photos").doc(guestUid).collection("items");
  const acctParent = db.collection("photos").doc(accountUid);
  const acctItems = acctParent.collection("items");

  const [
    guestPhotoSnap,
    guestParentSnap,
    setSnap,
    acctPhotoSnap,
    acctParentSnap,
  ] = await Promise.all([
    guestItems.get(),
    db.collection("photos").doc(guestUid).get(),
    db.collection("poseSets").where("uid", "==", guestUid).get(),
    acctItems.get(),
    acctParent.get(),
  ]);
  const guestPhotos = guestPhotoSnap.docs.map((d) => ({
    id: d.id,
    doc: d.data() as PhotoDoc,
  }));
  const guestSets = setSnap.docs.map((d) => ({
    id: d.id,
    doc: d.data() as PoseSetDoc,
  }));
  const acctPhotoIds = new Set(acctPhotoSnap.docs.map((d) => d.id));

  // Which finished try-ons are candidates, and so which photos come first.
  const candidates = guestSets.filter((s) => FINISHED.includes(s.doc.status));
  const backing = new Set(candidates.map((s) => s.doc.photoId));
  const ordered = [...guestPhotos].sort(
    (a, b) =>
      Number(backing.has(b.id)) - Number(backing.has(a.id)) ||
      ms(a.doc.createdAt) - ms(b.doc.createdAt),
  );

  // Photos: copy the object, then create the doc. Excess over the cap stays behind.
  const movedPhotoIds = new Set<string>();
  const used = new Set(acctPhotoSnap.docs.map((d) => String(d.get("label"))));
  let count = acctPhotoSnap.size;
  for (const p of ordered) {
    assertSegment("photoId", p.id);
    if (acctPhotoIds.has(p.id)) {
      movedPhotoIds.add(p.id);
      continue;
    }
    if (count >= MAX_PHOTOS) continue;
    if (
      !(await copyObject(
        photoPath(guestUid, p.id),
        photoPath(accountUid, p.id),
      ))
    )
      continue;
    let label = p.doc.label;
    if (used.has(label)) {
      let n = 1;
      while (used.has(`Photo ${n}`)) n++;
      label = `Photo ${n}`;
    }
    const doc: PhotoDoc = {
      storagePath: photoPath(accountUid, p.id),
      width: p.doc.width,
      height: p.doc.height,
      label,
      isGuest: false,
      createdAt: p.doc.createdAt,
      expiresAt: null,
    };
    try {
      await acctItems.doc(p.id).create(doc);
      used.add(label);
      count++;
      result.photos++;
    } catch (e) {
      if (!alreadyExists(e)) throw e;
    }
    movedPhotoIds.add(p.id);
  }
  if (movedPhotoIds.size > 0) {
    const guestDefault = (guestParentSnap.data() as PhotosDoc | undefined)
      ?.defaultPhotoId;
    const now = Timestamp.now();
    const current = (acctParentSnap.data() as PhotosDoc | undefined)
      ?.defaultPhotoId;
    const pick =
      guestDefault && movedPhotoIds.has(guestDefault)
        ? guestDefault
        : ordered.find((p) => movedPhotoIds.has(p.id))!.id;
    await acctParent.set(
      {
        defaultPhotoId: current ?? pick,
        isGuest: false,
        createdAt:
          (acctParentSnap.data() as PhotosDoc | undefined)?.createdAt ?? now,
        updatedAt: now,
        expiresAt: null,
      },
      { merge: true },
    );
  }

  // Finished try-ons whose photo moved.
  const movedSets: { id: string; doc: PoseSetDoc }[] = [];
  for (const s of candidates) {
    if (!movedPhotoIds.has(s.doc.photoId)) continue;
    const newId = poseSetIdFor(accountUid, s.doc);
    const existing = await db.collection("poseSets").doc(newId).get();
    const sameJob = existing.exists && existing.get("jobId") === s.doc.jobId;
    if (existing.exists && !sameJob) continue; // the account's own finished set wins
    for (const pose of s.doc.poses) {
      await copyObject(
        renderPath(guestUid, s.id, pose),
        renderPath(accountUid, newId, pose),
      );
    }
    if (!existing.exists) {
      const moved: PoseSetDoc = {
        ...s.doc,
        uid: accountUid,
        expiresAt: null,
      };
      try {
        await db.collection("poseSets").doc(newId).create(moved);
      } catch (e) {
        if (!alreadyExists(e)) throw e;
      }
    }
    // The job id stays, so /try-on/<jobId> keeps working.
    const jobRef = db
      .collection("jobs")
      .doc(assertSegment("jobId", s.doc.jobId));
    const job = await jobRef.get();
    if (job.exists && (job.data() as JobDoc).uid === guestUid) {
      await jobRef.update({
        uid: accountUid,
        poseSetId: newId,
        isGuest: false,
        expiresAt: null,
      });
    }
    movedSets.push(s);
    result.tryOns.push({
      jobId: s.doc.jobId,
      poseSetId: newId,
      itemId: s.doc.itemId,
    });
  }

  // Consent: the guest's, when the account has none (or an older version).
  const [guestConsent, acctConsent] = await Promise.all([
    getConsent(guestUid),
    getConsent(accountUid),
  ]);
  let consentSettled = acctConsent !== null;
  if (
    guestConsent &&
    (!acctConsent ||
      (acctConsent.version !== guestConsent.version &&
        ms(acctConsent.acceptedAt) < ms(guestConsent.acceptedAt)))
  ) {
    await db
      .collection("consents")
      .doc(accountUid)
      .set(guestConsent satisfies ConsentDoc);
    consentSettled = true;
  }

  // Follows: the union.
  const guestFollows = await db.collection("follows").doc(guestUid).get();
  const labels = (guestFollows.data() as FollowsDoc | undefined)?.labels ?? [];
  if (labels.length > 0) {
    labels.forEach((l) => assertSegment("labelSlug", l));
    await db
      .collection("follows")
      .doc(accountUid)
      .set(
        {
          labels: FieldValue.arrayUnion(...labels),
          updatedAt: Timestamp.now(),
        },
        { merge: true },
      );
    result.follows = labels.length;
  }

  // Only now delete what was moved from the guest. A photo still needed by a set that stays
  // (still rendering) stays too.
  const movedSetIds = new Set(movedSets.map((s) => s.id));
  const staying = guestSets.filter((s) => !movedSetIds.has(s.id));
  const needed = new Set(staying.map((s) => s.doc.photoId));
  for (const s of movedSets) {
    await db.collection("poseSets").doc(s.id).delete();
    await deleteRendersForPoseSet(guestUid, s.id);
    await deleteStagingForJob(s.doc.jobId);
  }
  const gone = [...movedPhotoIds].filter((id) => !needed.has(id));
  for (const id of gone) {
    await guestItems.doc(id).delete();
    await deletePhotoObject(guestUid, id);
  }
  const left = await guestItems.count().get();
  if (left.data().count === 0)
    await db.collection("photos").doc(guestUid).delete();
  else if (gone.includes(String(guestParentSnap.get("defaultPhotoId")))) {
    const rest = await guestItems.get();
    await db
      .collection("photos")
      .doc(guestUid)
      .update({ defaultPhotoId: rest.docs[0]!.id });
  }
  if (consentSettled && guestConsent) {
    await db.collection("consents").doc(guestUid).delete();
  }
  if (labels.length > 0) await db.collection("follows").doc(guestUid).delete();

  // Only a guest with nothing left behind loses its sign-in; otherwise the purge removes it.
  result.stayed = {
    photos: left.data().count,
    tryOns: staying.filter(
      (s) =>
        s.doc.status === "rendering" ||
        (FINISHED.includes(s.doc.status) && !movedPhotoIds.has(s.doc.photoId)),
    ).length,
  };
  if (result.stayed.photos > 0 || result.stayed.tryOns > 0) return result;
  try {
    await auth().deleteUser(guestUid);
  } catch (e) {
    if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
  }
  return result;
}

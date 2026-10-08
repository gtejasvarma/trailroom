import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firestore } from "./app";
import { assertSegment } from "./paths";
import { expiryFor, type PoseSetDoc } from "./types";

const col = () => firestore().collection("poseSets");

/** The cache key IS the doc id: {uid}_{identityVersion}_{itemId}. */
export function poseSetId(
  uid: string,
  identityVersion: number,
  itemId: string,
): string {
  if (!Number.isInteger(identityVersion) || identityVersion < 0) {
    throw new Error("invalid identityVersion");
  }
  return assertSegment(
    "poseSetId",
    `${assertSegment("uid", uid)}_${identityVersion}_${assertSegment("itemId", itemId)}`,
  );
}

export class PoseSetExistsError extends Error {
  constructor(
    readonly id: string,
    readonly existing: PoseSetDoc | null,
  ) {
    super(`pose set ${id} already exists`);
    this.name = "PoseSetExistsError";
  }
}

export interface ClaimPoseSetInput {
  uid: string;
  itemId: string;
  identityVersion: number;
  jobId: string;
  isGuest: boolean;
}

/** Atomically claims the cache key with create(); a second claim throws PoseSetExistsError. */
export async function claimPoseSet(
  input: ClaimPoseSetInput,
  now: Date = new Date(),
): Promise<{ id: string; poseSet: PoseSetDoc }> {
  const id = poseSetId(input.uid, input.identityVersion, input.itemId);
  const poseSet: PoseSetDoc = {
    uid: input.uid,
    itemId: input.itemId,
    identityVersion: input.identityVersion,
    jobId: input.jobId,
    status: "rendering",
    poses: [],
    createdAt: Timestamp.fromDate(now),
    expiresAt: expiryFor(input.isGuest, now),
  };
  try {
    await col().doc(id).create(poseSet);
  } catch (err) {
    const code = (err as { code?: number | string }).code;
    if (code === 6 || code === "already-exists" || code === "ALREADY_EXISTS") {
      const snap = await col().doc(id).get();
      throw new PoseSetExistsError(
        id,
        snap.exists ? (snap.data() as PoseSetDoc) : null,
      );
    }
    throw err;
  }
  return { id, poseSet };
}

export async function getPoseSet(id: string): Promise<PoseSetDoc | null> {
  const snap = await col().doc(assertSegment("poseSetId", id)).get();
  return snap.exists ? (snap.data() as PoseSetDoc) : null;
}

export type PoseSetPatch = Partial<
  Pick<PoseSetDoc, "status" | "poses" | "jobId">
>;

export async function updatePoseSet(
  id: string,
  patch: PoseSetPatch,
): Promise<void> {
  await col()
    .doc(assertSegment("poseSetId", id))
    .update({ ...patch });
}

/** Adds one pose with arrayUnion, so parallel publishes never overwrite each other. */
export async function addPoseToSet(id: string, pose: string): Promise<void> {
  await col()
    .doc(assertSegment("poseSetId", id))
    .update({ poses: FieldValue.arrayUnion(assertSegment("pose", pose)) });
}

export async function deletePoseSet(id: string): Promise<void> {
  await col().doc(assertSegment("poseSetId", id)).delete();
}

export async function countPoseSetsForUser(uid: string): Promise<number> {
  const snap = await col()
    .where("uid", "==", assertSegment("uid", uid))
    .count()
    .get();
  return snap.data().count;
}

/** All of a user's pose sets (ids included), oldest first. */
export async function listPoseSetsForUser(
  uid: string,
): Promise<{ id: string; poseSet: PoseSetDoc }[]> {
  const snap = await col().where("uid", "==", assertSegment("uid", uid)).get();
  return snap.docs
    .map((d) => ({ id: d.id, poseSet: d.data() as PoseSetDoc }))
    .sort(
      (a, b) => a.poseSet.createdAt.toMillis() - b.poseSet.createdAt.toMillis(),
    );
}

/**
 * Deletes the pose set only if it is still `failed` (checked in a transaction, so a concurrent
 * retry that already replaced it is never removed). Returns the removed doc, or null.
 */
export async function deletePoseSetIfFailed(
  id: string,
): Promise<PoseSetDoc | null> {
  const ref = col().doc(assertSegment("poseSetId", id));
  return firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const doc = snap.data() as PoseSetDoc;
    if (doc.status !== "failed") return null;
    tx.delete(ref);
    return doc;
  });
}

import { randomBytes } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "./app";
import { photoPath, assertSegment } from "./paths";
import { expiryFor, MAX_PHOTOS, type PhotoDoc, type PhotosDoc } from "./types";

const parentRef = (uid: string) =>
  firestore().collection("photos").doc(assertSegment("uid", uid));
const itemsCol = (uid: string) => parentRef(uid).collection("items");

export class PhotoLimitError extends Error {
  constructor() {
    super(`at most ${MAX_PHOTOS} photos per person`);
    this.name = "PhotoLimitError";
  }
}

export interface AddPhotoInput {
  width: number;
  height: number;
  isGuest: boolean;
  /** Test seam; otherwise a random id. */
  photoId?: string;
}

export type StoredPhoto = PhotoDoc & { id: string };

export const newPhotoId = () => randomBytes(8).toString("hex");

/**
 * Adds a photo in a transaction. The first photo becomes the default; the 7th throws
 * PhotoLimitError. The label is "Photo N" with the smallest N not already in use. The parent
 * doc's guest expiry is refreshed on every add.
 */
export async function addPhoto(
  uid: string,
  input: AddPhotoInput,
  now: Date = new Date(),
): Promise<{ photo: StoredPhoto; isDefault: boolean }> {
  const parent = parentRef(uid);
  const photoId = assertSegment("photoId", input.photoId ?? newPhotoId());
  const ref = itemsCol(uid).doc(photoId);
  return firestore().runTransaction(async (tx) => {
    const [parentSnap, items] = await Promise.all([
      tx.get(parent),
      tx.get(itemsCol(uid)),
    ]);
    if (items.size >= MAX_PHOTOS) throw new PhotoLimitError();
    const used = new Set(items.docs.map((d) => String(d.get("label"))));
    let n = 1;
    while (used.has(`Photo ${n}`)) n++;
    const doc: PhotoDoc = {
      storagePath: photoPath(uid, photoId),
      width: input.width,
      height: input.height,
      label: `Photo ${n}`,
      isGuest: input.isGuest,
      createdAt: Timestamp.fromDate(now),
      expiresAt: expiryFor(input.isGuest, now),
    };
    const prev = parentSnap.exists ? (parentSnap.data() as PhotosDoc) : null;
    const defaultPhotoId = prev?.defaultPhotoId ?? photoId;
    const next: PhotosDoc = {
      defaultPhotoId,
      isGuest: input.isGuest,
      createdAt: prev?.createdAt ?? Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      expiresAt: expiryFor(input.isGuest, now),
    };
    tx.create(ref, doc);
    tx.set(parent, next);
    return {
      photo: { ...doc, id: photoId },
      isDefault: defaultPhotoId === photoId,
    };
  });
}

export async function getPhoto(
  uid: string,
  photoId: string,
): Promise<StoredPhoto | null> {
  const snap = await itemsCol(uid).doc(assertSegment("photoId", photoId)).get();
  return snap.exists ? { ...(snap.data() as PhotoDoc), id: snap.id } : null;
}

/** All of a person's photos, oldest first. */
export async function listPhotos(uid: string): Promise<StoredPhoto[]> {
  const snap = await itemsCol(uid).get();
  return snap.docs
    .map((d) => ({ ...(d.data() as PhotoDoc), id: d.id }))
    .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
}

export async function countPhotos(uid: string): Promise<number> {
  return (await itemsCol(uid).count().get()).data().count;
}

export async function getDefaultPhotoId(uid: string): Promise<string | null> {
  const snap = await parentRef(uid).get();
  return snap.exists
    ? ((snap.data() as PhotosDoc).defaultPhotoId ?? null)
    : null;
}

/** False when the photo does not exist. */
export async function setDefaultPhoto(
  uid: string,
  photoId: string,
): Promise<boolean> {
  const item = itemsCol(uid).doc(assertSegment("photoId", photoId));
  return firestore().runTransaction(async (tx) => {
    if (!(await tx.get(item)).exists) return false;
    tx.update(parentRef(uid), {
      defaultPhotoId: photoId,
      updatedAt: Timestamp.now(),
    });
    return true;
  });
}

/**
 * Removes the photo doc. If it was the default, the oldest remaining photo becomes the default;
 * with none left the parent doc goes too. Returns false when the photo did not exist.
 */
export async function deletePhoto(
  uid: string,
  photoId: string,
): Promise<boolean> {
  const item = itemsCol(uid).doc(assertSegment("photoId", photoId));
  return firestore().runTransaction(async (tx) => {
    const [snap, parentSnap, items] = await Promise.all([
      tx.get(item),
      tx.get(parentRef(uid)),
      tx.get(itemsCol(uid)),
    ]);
    if (!snap.exists) return false;
    const rest = items.docs
      .filter((d) => d.id !== photoId)
      .sort(
        (a, b) =>
          (a.get("createdAt") as Timestamp).toMillis() -
          (b.get("createdAt") as Timestamp).toMillis(),
      );
    tx.delete(item);
    if (rest.length === 0) {
      if (parentSnap.exists) tx.delete(parentRef(uid));
    } else if (
      (parentSnap.data() as PhotosDoc | undefined)?.defaultPhotoId === photoId
    ) {
      tx.update(parentRef(uid), {
        defaultPhotoId: rest[0]!.id,
        updatedAt: Timestamp.now(),
      });
    }
    return true;
  });
}

/** Removes the parent doc and every photo doc under it. */
export async function deleteAllPhotoDocs(uid: string): Promise<void> {
  await firestore().recursiveDelete(parentRef(uid));
}

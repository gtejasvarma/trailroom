import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "./app";
import { photoPath, assertSegment } from "./paths";
import { expiryFor, type PhotoDoc } from "./types";

export interface SavePhotoInput {
  width: number;
  height: number;
  isGuest: boolean;
}

/**
 * Writes photos/{uid}. identityVersion is previous + 1 (1 for the first photo), computed in a
 * transaction so two concurrent replacements never reuse a version.
 */
export async function savePhoto(
  uid: string,
  input: SavePhotoInput,
  now: Date = new Date(),
): Promise<PhotoDoc> {
  const ref = firestore().collection("photos").doc(assertSegment("uid", uid));
  return firestore().runTransaction(async (tx) => {
    const prev = await tx.get(ref);
    const identityVersion =
      (prev.exists ? (prev.data() as PhotoDoc).identityVersion : 0) + 1;
    const doc: PhotoDoc = {
      storagePath: photoPath(uid),
      width: input.width,
      height: input.height,
      identityVersion,
      isGuest: input.isGuest,
      createdAt: Timestamp.fromDate(now),
      expiresAt: expiryFor(input.isGuest, now),
    };
    tx.set(ref, doc);
    return doc;
  });
}

export async function getPhoto(uid: string): Promise<PhotoDoc | null> {
  const snap = await firestore()
    .collection("photos")
    .doc(assertSegment("uid", uid))
    .get();
  return snap.exists ? (snap.data() as PhotoDoc) : null;
}

export async function deletePhoto(uid: string): Promise<void> {
  await firestore()
    .collection("photos")
    .doc(assertSegment("uid", uid))
    .delete();
}

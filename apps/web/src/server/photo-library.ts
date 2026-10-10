// The person's own photos: list, thumbnail, make default, remove. Every call is scoped to the
// caller's uid in the path, so another person's photo id is simply "not found".
import sharp from "sharp";
import {
  deletePhoto,
  deletePhotoObject,
  dropArrivalCards,
  getArrivals,
  getDefaultPhotoId,
  getPhotoBytes,
  kindOf,
  listPhotos,
  listPoseSetsForUser,
  setDefaultPhoto,
} from "@trailroom/db";
import { discardArrivalSet } from "@trailroom/pipeline";
import { err, ok, type Result } from "./http";
import type { User } from "./auth";

const THUMB_BOX = 360;

export interface PhotoSummary {
  id: string;
  label: string;
  isDefault: boolean;
  /** Needs the ID token to fetch, like the renders. */
  thumbUrl: string;
}

export async function listMyPhotos(
  user: User,
): Promise<Result<{ photos: PhotoSummary[]; defaultPhotoId: string | null }>> {
  const [photos, defaultPhotoId] = await Promise.all([
    listPhotos(user.uid),
    getDefaultPhotoId(user.uid),
  ]);
  return ok({
    defaultPhotoId,
    photos: photos.map((p) => ({
      id: p.id,
      label: p.label,
      isDefault: p.id === defaultPhotoId,
      thumbUrl: `/api/photos/${p.id}/thumb`,
    })),
  });
}

/** A downscaled JPEG with no metadata. Shown back to its owner only. */
export async function getThumb(
  user: User,
  photoId: string,
): Promise<Result<{ bytes: Buffer; contentType: string }>> {
  try {
    const stored = await getPhotoBytes(user.uid, photoId);
    if (!stored) return err("not_found");
    const bytes = await sharp(stored.data)
      .resize({
        width: THUMB_BOX,
        height: THUMB_BOX,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 78 })
      .toBuffer();
    return ok({ bytes, contentType: "image/jpeg" });
  } catch {
    return err("not_found"); // invalid path segments
  }
}

export async function makeDefault(
  user: User,
  photoId: string,
): Promise<Result<{ defaultPhotoId: string }>> {
  try {
    if (!(await setDefaultPhoto(user.uid, photoId))) return err("not_found");
  } catch {
    return err("not_found");
  }
  return ok({ defaultPhotoId: photoId });
}

/**
 * A photo an in-flight try-on is rendering from cannot be removed; the rest can. A buffer render
 * ("arrives on you") is not in that count: the person did not ask for it, so it never holds a
 * photo. Removing the photo deletes the arrival renders made from it (sets, jobs, renders) and
 * their cards; one still in flight finds its job gone and leaves nothing behind.
 */
export async function removePhoto(
  user: User,
  photoId: string,
): Promise<Result<{ defaultPhotoId: string | null }>> {
  try {
    const sets = await listPoseSetsForUser(user.uid);
    if (
      sets.some(
        (s) =>
          s.poseSet.photoId === photoId &&
          s.poseSet.status === "rendering" &&
          kindOf(s.poseSet) !== "arrival",
      )
    ) {
      return err("photo_in_use");
    }
    if (!(await deletePhoto(user.uid, photoId))) return err("not_found");
    for (const s of sets) {
      if (s.poseSet.photoId === photoId && kindOf(s.poseSet) === "arrival") {
        await discardArrivalSet({
          uid: user.uid,
          poseSetId: s.id,
          jobId: s.poseSet.jobId,
        });
      }
    }
    const cards = ((await getArrivals(user.uid))?.cards ?? [])
      .filter((c) => c.photoId === photoId)
      .map((c) => c.itemId);
    // Forgotten as well as dropped: the piece may be offered again on another photo.
    if (cards.length > 0) await dropArrivalCards(user.uid, cards, cards);
    await deletePhotoObject(user.uid, photoId);
  } catch {
    return err("not_found");
  }
  return ok({ defaultPhotoId: await getDefaultPhotoId(user.uid) });
}

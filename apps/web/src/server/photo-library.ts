// The person's own photos: list, thumbnail, make default, remove. Every call is scoped to the
// caller's uid in the path, so another person's photo id is simply "not found".
import sharp from "sharp";
import {
  deletePhoto,
  deletePhotoObject,
  getDefaultPhotoId,
  getPhotoBytes,
  listPhotos,
  listPoseSetsForUser,
  setDefaultPhoto,
} from "@trailroom/db";
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

/** A photo an in-flight job is rendering from cannot be removed; the rest can. */
export async function removePhoto(
  user: User,
  photoId: string,
): Promise<Result<{ defaultPhotoId: string | null }>> {
  try {
    const sets = await listPoseSetsForUser(user.uid);
    if (
      sets.some(
        (s) =>
          s.poseSet.photoId === photoId && s.poseSet.status === "rendering",
      )
    ) {
      return err("photo_in_use");
    }
    if (!(await deletePhoto(user.uid, photoId))) return err("not_found");
    await deletePhotoObject(user.uid, photoId);
  } catch {
    return err("not_found");
  }
  return ok({ defaultPhotoId: await getDefaultPhotoId(user.uid) });
}

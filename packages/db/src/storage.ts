import { bucket } from "./app";
import {
  catalogPath,
  extFor,
  photoPath,
  renderPath,
  renderPrefix,
  photoPrefix,
  stagingPath,
  stagingPrefix,
} from "./paths";

export interface StoredObject {
  data: Buffer;
  contentType: string;
}

async function put(path: string, buf: Buffer, contentType: string) {
  await bucket().file(path).save(buf, { contentType, resumable: false });
}

async function get(path: string): Promise<StoredObject | null> {
  const file = bucket().file(path);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [data] = await file.download();
  const [meta] = await file.getMetadata();
  return {
    data,
    contentType: String(meta.contentType ?? "application/octet-stream"),
  };
}

export async function putPhoto(
  uid: string,
  buf: Buffer,
  contentType = "image/jpeg",
): Promise<string> {
  const path = photoPath(uid);
  await put(path, buf, contentType);
  return path;
}

export const getPhotoBytes = (uid: string) => get(photoPath(uid));

export async function putStaging(
  jobId: string,
  pose: string,
  attempt: number,
  buf: Buffer,
  contentType = "image/png",
): Promise<string> {
  const path = stagingPath(jobId, pose, attempt, extFor(contentType));
  await put(path, buf, contentType);
  return path;
}

/** Looks for the staged object under any supported extension. */
export async function getStaging(
  jobId: string,
  pose: string,
  attempt: number,
): Promise<StoredObject | null> {
  for (const ext of ["png", "jpg", "webp"]) {
    const found = await get(stagingPath(jobId, pose, attempt, ext));
    if (found) return found;
  }
  return null;
}

export async function deleteStagingForJob(jobId: string): Promise<void> {
  await bucket().deleteFiles({ prefix: stagingPrefix(jobId), force: true });
}

export async function publishRender(
  uid: string,
  poseSetId: string,
  pose: string,
  buf: Buffer,
): Promise<string> {
  const path = renderPath(uid, poseSetId, pose);
  await put(path, buf, "image/jpeg");
  return path;
}

export const getRender = (uid: string, poseSetId: string, pose: string) =>
  get(renderPath(uid, poseSetId, pose));

export async function deleteRender(
  uid: string,
  poseSetId: string,
  pose: string,
): Promise<void> {
  await bucket()
    .file(renderPath(uid, poseSetId, pose))
    .delete({
      ignoreNotFound: true,
    });
}

export async function deleteRendersForPoseSet(
  uid: string,
  poseSetId: string,
): Promise<void> {
  await bucket().deleteFiles({
    prefix: renderPrefix(uid, poseSetId),
    force: true,
  });
}

export async function deletePhotoObject(uid: string): Promise<void> {
  await bucket().deleteFiles({ prefix: photoPrefix(uid), force: true });
}

export async function deleteRendersForUser(uid: string): Promise<void> {
  await bucket().deleteFiles({ prefix: renderPrefix(uid), force: true });
}

/** A garment image from `catalog/<file>`; null when the object does not exist. */
export const getCatalogImage = (file: string) => get(catalogPath(file));

export async function putCatalogImage(
  file: string,
  buf: Buffer,
  contentType = "image/jpeg",
): Promise<string> {
  const path = catalogPath(file);
  await put(path, buf, contentType);
  return path;
}

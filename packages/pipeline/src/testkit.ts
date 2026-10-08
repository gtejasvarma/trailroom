// Test-only fixtures for emulator-backed tests (like packages/db's emu-helpers). Never imported
// by product code.
import sharp from "sharp";
import {
  bucket,
  claimPoseSet,
  createJob,
  getJob,
  putPhoto,
  recordConsent,
  savePhoto,
  poseSetId,
  type JobDoc,
} from "@trailroom/db";
import { POSES } from "@trailroom/render";

export const POSE_LIST = Object.keys(POSES);

/** A 768x1024 JPEG "person" that differs from everything the fake provider produces. */
export async function personPhoto(): Promise<Buffer> {
  const w = 768;
  const h = 1024;
  const raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 3;
      raw[o] = 30 + ((x * 100) / w) * 0.5;
      raw[o + 1] = 80 + ((y * 90) / h) * 0.5;
      raw[o + 2] = (((x >> 6) ^ (y >> 6)) & 1) * 90 + 40;
    }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } })
    .jpeg({ quality: 92 })
    .toBuffer();
}

export async function makeJob(
  uid: string,
  itemId = "g-parka",
  poses: string[] = POSE_LIST,
): Promise<{ jobId: string; poseSetId: string; uid: string }> {
  await recordConsent(uid, "v1");
  await putPhoto(uid, await personPhoto());
  const photo = await savePhoto(uid, {
    width: 768,
    height: 1024,
    isGuest: false,
  });
  const psId = poseSetId(uid, photo.identityVersion, itemId);
  const { id } = await createJob({
    uid,
    itemId,
    identityVersion: photo.identityVersion,
    poseSetId: psId,
    poseOrder: poses,
    poses: Object.fromEntries(
      poses.map((p) => [p, { status: "pending", attempt: 0, reasons: [] }]),
    ),
    qaSkipped: [],
    model: "nano-banana-2.1",
    promptVersion: "edit-v1",
    isGuest: false,
  });
  await claimPoseSet({
    uid,
    itemId,
    identityVersion: photo.identityVersion,
    jobId: id,
    isGuest: false,
  });
  return { jobId: id, poseSetId: psId, uid };
}

export async function listObjects(prefix: string): Promise<string[]> {
  const [files] = await bucket().getFiles({ prefix });
  return files.map((f) => f.name).sort();
}

export async function clearBucket(): Promise<void> {
  for (const prefix of ["renders/", "staging/", "photos/"]) {
    await bucket().deleteFiles({ prefix, force: true });
  }
}

/** The job doc with volatile fields removed, for "same document" comparisons. */
export async function jobSnapshot(jobId: string): Promise<unknown> {
  const j = (await getJob(jobId)) as JobDoc;
  const { updatedAt: _u, ...rest } = j;
  return JSON.parse(JSON.stringify(rest));
}

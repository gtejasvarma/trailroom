// Upload validation and the stripped re-encode. Nothing is stored until consent is on file and
// the bytes decode as an allowed image of usable shape.
import sharp, { type Metadata, type OutputInfo } from "sharp";
import {
  deletePhoto,
  deletePhotoObject,
  isConsentCurrent,
  listPoseSetsForUser,
  putPhoto,
  savePhoto,
} from "@trailroom/db";
import { CONSENT_VERSION } from "../lib/consent";
import { err, ok, type Result } from "./http";
import type { User } from "./auth";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MIN_SHORT_SIDE = 768;
export const MAX_LONG_SIDE = 2048;
/** Wider than tall by more than 4:3, or taller than 1:3, is refused. */
export const MAX_WIDE_RATIO = 4 / 3;
export const MAX_TALL_RATIO = 3;
const ALLOWED = new Set(["jpeg", "png", "webp"]);
// Multipart framing adds a little to the file itself.
const BODY_SLACK = 64 * 1024;
/** Decompression-bomb guard: a tiny file can declare enormous dimensions. */
export const MAX_INPUT_PIXELS = 50_000_000;
const sharpOf = (bytes: Buffer) =>
  sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS });
const isPixelLimit = (e: unknown) =>
  /pixel limit/i.test(e instanceof Error ? e.message : "");

export interface PhotoBody {
  identityVersion: number;
  width: number;
  height: number;
}

export async function uploadPhoto(
  user: User,
  request: Request,
): Promise<Result<PhotoBody>> {
  // Consent first: before the body is parsed or any byte is kept.
  if (!(await isConsentCurrent(user.uid, CONSENT_VERSION))) {
    return err("consent_required");
  }
  // A job in flight reads the photo by its cache key; replacing the photo now would let it read
  // different bytes than the key names.
  const sets = await listPoseSetsForUser(user.uid);
  if (sets.some((s) => s.poseSet.status === "rendering")) {
    return err("render_in_progress");
  }

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES + BODY_SLACK) {
    return err("too_large");
  }

  const bytes = await readBytes(request);
  if (bytes === "too_large") return err("too_large");
  if (bytes === null) return err("invalid_request");
  if (bytes.length > MAX_UPLOAD_BYTES) return err("too_large");
  return processPhoto(user, bytes);
}

/**
 * Reads the body as a stream and stops as soon as more than `max` bytes have arrived, so a
 * chunked upload with no Content-Length cannot buffer without bound. Null when over the limit.
 */
export async function readCapped(
  body: ReadableStream<Uint8Array> | null,
  max: number,
): Promise<Buffer | null> {
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function readBytes(
  request: Request,
): Promise<Buffer | "too_large" | null> {
  const type = (request.headers.get("content-type") ?? "").toLowerCase();
  const isMultipart = type.startsWith("multipart/form-data");
  if (
    !isMultipart &&
    !type.startsWith("image/") &&
    type !== "application/octet-stream"
  ) {
    return null;
  }
  const raw = await readCapped(
    request.body,
    MAX_UPLOAD_BYTES + (isMultipart ? BODY_SLACK : 0),
  );
  if (raw === null) return "too_large";
  if (!isMultipart) return raw;
  let form: FormData;
  try {
    form = await new Response(new Uint8Array(raw), {
      headers: { "content-type": request.headers.get("content-type")! },
    }).formData();
  } catch {
    return null;
  }
  const file = form.get("photo");
  if (!file || typeof file === "string") return null;
  return Buffer.from(await file.arrayBuffer());
}

export async function processPhoto(
  user: User,
  bytes: Buffer,
  /** Test seam: runs after the photo is stored, to simulate a racing delete. */
  hooks: { afterStore?: () => Promise<void> } = {},
): Promise<Result<PhotoBody>> {
  // Decode to find out what it really is; the content type and extension are not trusted.
  let meta: Metadata;
  try {
    meta = await sharpOf(bytes).metadata();
  } catch (e) {
    if (isPixelLimit(e)) return err("too_large");
    return err("not_an_image");
  }
  if (!meta.format || !meta.width || !meta.height) return err("not_an_image");
  if (!ALLOWED.has(meta.format)) return err("unsupported_type");
  if (meta.width * meta.height > MAX_INPUT_PIXELS) return err("too_large");

  // EXIF orientations 5-8 swap the axes.
  const swap = (meta.orientation ?? 1) >= 5;
  const w = swap ? meta.height : meta.width;
  const h = swap ? meta.width : meta.height;
  if (Math.min(w, h) < MIN_SHORT_SIDE) return err("too_small");
  if (w / h > MAX_WIDE_RATIO || h / w > MAX_TALL_RATIO)
    return err("bad_aspect");

  let out: { data: Buffer; info: OutputInfo };
  try {
    out = await sharpOf(bytes)
      .rotate() // apply EXIF orientation, then drop it
      // Uniform downscale of the whole photo; never upscales, aspect ratio preserved.
      .resize({
        width: MAX_LONG_SIDE,
        height: MAX_LONG_SIDE,
        fit: "inside",
        withoutEnlargement: true,
      })
      // No withMetadata(): EXIF, GPS, ICC and XMP are all dropped.
      .jpeg({ quality: 90 })
      .toBuffer({ resolveWithObject: true });
  } catch (e) {
    if (isPixelLimit(e)) return err("too_large");
    return err("not_an_image");
  }

  await putPhoto(user.uid, out.data, "image/jpeg");
  const doc = await savePhoto(user.uid, {
    width: out.info.width,
    height: out.info.height,
    isGuest: user.isGuest,
  });
  await hooks.afterStore?.();
  // Consent may have been withdrawn (Delete my photo) while we were storing: leave nothing.
  if (!(await isConsentCurrent(user.uid, CONSENT_VERSION))) {
    await deletePhotoObject(user.uid);
    await deletePhoto(user.uid);
    return err("consent_required");
  }
  return ok({
    identityVersion: doc.identityVersion,
    width: doc.width,
    height: doc.height,
  });
}

// Upload validation and the stripped re-encode. Nothing is stored until the request carries the
// current consent version and the bytes decode as an allowed image of usable shape. The consent
// document is written at that moment, after validation and before the photo is stored.
import sharp, { type Metadata, type OutputInfo } from "sharp";
import {
  addPhoto,
  countPhotos,
  deleteAllPhotoDocs,
  deletePhotoObject,
  isConsentCurrent,
  MAX_PHOTOS,
  newPhotoId,
  PhotoLimitError,
  putPhoto,
  recordConsent,
} from "@trailroom/db";
import { CONSENT_VERSION } from "../lib/consent";
import {
  checkPhotoFacts,
  MAX_INPUT_PIXELS,
  MAX_LONG_SIDE,
  MAX_UPLOAD_BYTES,
} from "../lib/photo-check";
import { err, ok, type Result } from "./http";
import type { User } from "./auth";

export { MAX_UPLOAD_BYTES };
// Multipart framing adds a little to the file itself.
const BODY_SLACK = 64 * 1024;
const sharpOf = (bytes: Buffer) =>
  sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS });
const isPixelLimit = (e: unknown) =>
  /pixel limit/i.test(e instanceof Error ? e.message : "");

export interface PhotoBody {
  photoId: string;
  isDefault: boolean;
  label: string;
  width: number;
  height: number;
}

/** What a request carries: the image, and the consent version the client says it showed. */
interface UploadParts {
  bytes: Buffer;
  consent: string | null;
}

export async function uploadPhoto(
  user: User,
  request: Request,
): Promise<Result<PhotoBody>> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES + BODY_SLACK) {
    return err("too_large");
  }

  const parts = await readParts(request);
  if (parts === "too_large") return err("too_large");
  if (parts === null) return err("invalid_request");
  // Without the current version in the request, nothing is stored and nothing is recorded.
  if (parts.consent !== CONSENT_VERSION) return err("consent_required");
  if (parts.bytes.length > MAX_UPLOAD_BYTES) return err("too_large");
  if ((await countPhotos(user.uid)) >= MAX_PHOTOS) return err("photo_limit");
  return processPhoto(user, parts.bytes);
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

async function readParts(
  request: Request,
): Promise<UploadParts | "too_large" | null> {
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
  if (!isMultipart) {
    // A raw image body carries the consent version in a header.
    return { bytes: raw, consent: request.headers.get("x-consent-version") };
  }
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
  const consent = form.get("consent");
  return {
    bytes: Buffer.from(await file.arrayBuffer()),
    consent: typeof consent === "string" ? consent : null,
  };
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
  // EXIF orientations 5-8 swap the axes.
  const swap = (meta.orientation ?? 1) >= 5;
  const rejection = checkPhotoFacts({
    bytes: bytes.length,
    format: meta.format ?? null,
    width: (swap ? meta.height : meta.width) ?? 0,
    height: (swap ? meta.width : meta.height) ?? 0,
  });
  if (rejection) return err(rejection);

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

  // Consent first, then the photo: the consent record is never later than the photo it covers.
  await recordConsent(user.uid, CONSENT_VERSION);
  const photoId = newPhotoId();
  await putPhoto(user.uid, photoId, out.data, "image/jpeg");
  let added;
  try {
    added = await addPhoto(user.uid, {
      photoId,
      width: out.info.width,
      height: out.info.height,
      isGuest: user.isGuest,
    });
  } catch (e) {
    await deletePhotoObject(user.uid, photoId);
    if (e instanceof PhotoLimitError) return err("photo_limit");
    throw e;
  }
  await hooks.afterStore?.();
  // "Delete everything" may have run while we were storing: leave nothing.
  if (!(await isConsentCurrent(user.uid, CONSENT_VERSION))) {
    await deletePhotoObject(user.uid, photoId);
    await deleteAllPhotoDocs(user.uid);
    return err("consent_required");
  }
  return ok({
    photoId,
    isDefault: added.isDefault,
    label: added.photo.label,
    width: added.photo.width,
    height: added.photo.height,
  });
}

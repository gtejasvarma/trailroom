// Client-safe: no imports. The photo rules in one place. The server (server/photo.ts) and the
// browser's instant check both call checkPhotoFacts, so the two cannot drift; the server repeats
// every check on the bytes it actually receives.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MIN_SHORT_SIDE = 768;
export const MAX_LONG_SIDE = 2048;
/** Wider than tall by more than 4:3, or taller than 1:3, is refused. */
export const MAX_WIDE_RATIO = 4 / 3;
export const MAX_TALL_RATIO = 3;
/** Decompression-bomb guard: a tiny file can declare enormous dimensions. */
export const MAX_INPUT_PIXELS = 50_000_000;
export const ALLOWED_FORMATS: readonly string[] = ["jpeg", "png", "webp"];

export type PhotoRejection =
  | "not_an_image"
  | "unsupported_type"
  | "too_large"
  | "too_small"
  | "bad_aspect";

export interface PhotoFacts {
  /** Size of the file in bytes, when known. */
  bytes?: number;
  /** Decoded format name ("jpeg", "png", "webp", "gif"…); null when it did not decode. */
  format: string | null;
  /** Displayed size, after any EXIF rotation. 0 when it did not decode. */
  width: number;
  height: number;
}

/** The first rule a photo breaks, in the order the server applies them; null when it passes. */
export function checkPhotoFacts(f: PhotoFacts): PhotoRejection | null {
  if (f.bytes !== undefined && f.bytes > MAX_UPLOAD_BYTES) return "too_large";
  if (!f.format || !f.width || !f.height) return "not_an_image";
  if (!ALLOWED_FORMATS.includes(f.format)) return "unsupported_type";
  if (f.width * f.height > MAX_INPUT_PIXELS) return "too_large";
  if (Math.min(f.width, f.height) < MIN_SHORT_SIDE) return "too_small";
  if (
    f.width / f.height > MAX_WIDE_RATIO ||
    f.height / f.width > MAX_TALL_RATIO
  )
    return "bad_aspect";
  return null;
}

/** "image/jpeg" to "jpeg"; anything else to its subtype, null when empty. */
export function formatOfMime(mime: string): string | null {
  const m = /^image\/([a-z0-9.+-]+)$/i.exec(mime.trim());
  if (!m) return null;
  const sub = m[1]!.toLowerCase();
  return sub === "jpg" ? "jpeg" : sub;
}

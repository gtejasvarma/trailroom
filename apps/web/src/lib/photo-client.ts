"use client";
// The browser's instant check. It decodes the file and asks checkPhotoFacts, the same function
// the server uses, then shows the server's own message for the reason. The server repeats it all.
import { ERRORS } from "../server/errors";
import {
  checkPhotoFacts,
  formatOfMime,
  type PhotoRejection,
} from "./photo-check";

export type Inspected =
  | { ok: true; width: number; height: number }
  | { ok: false; code: PhotoRejection; message: string };

const reject = (code: PhotoRejection): Inspected => ({
  ok: false,
  code,
  message: ERRORS[code].message,
});

export async function inspectPhoto(
  file: Blob,
  type?: string,
): Promise<Inspected> {
  const mime = type ?? file.type;
  const format = formatOfMime(mime);
  // A format we do not accept is reported by type before any decode (HEIC may not decode at all).
  const early = checkPhotoFacts({
    bytes: file.size,
    format,
    width: 1,
    height: 1,
  });
  if (early === "too_large" || early === "unsupported_type")
    return reject(early);
  try {
    // createImageBitmap applies the EXIF orientation, so width/height are as displayed.
    const bmp = await createImageBitmap(file);
    const { width, height } = bmp;
    bmp.close();
    const code = checkPhotoFacts({ bytes: file.size, format, width, height });
    return code ? reject(code) : { ok: true, width, height };
  } catch {
    return reject("not_an_image");
  }
}

/** Mean brightness 0-255 of the current video frame, from a tiny downscale; null if unreadable. */
export function frameBrightness(video: HTMLVideoElement): number | null {
  if (!video.videoWidth) return null;
  try {
    const c = document.createElement("canvas");
    c.width = 24;
    c.height = 24;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, 24, 24);
    const d = ctx.getImageData(0, 0, 24, 24).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) {
      sum += 0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!;
    }
    return sum / (d.length / 4);
  } catch {
    return null;
  }
}

/** Below this mean brightness the camera view says it looks dark. */
export const DIM_BELOW = 55;

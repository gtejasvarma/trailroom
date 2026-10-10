// The image behind an ask. The only things a link can reach: the asker's Front render for a piece
// in the ask, when that piece's frozen pose set is still complete and still theirs, otherwise the
// label's own photograph. Never another pose, another piece, the photo, or staging.
import { getItem } from "@trailroom/catalog";
import {
  getPhoto,
  getPoseSet,
  getRender,
  renderExists,
  type AskDoc,
} from "@trailroom/db";
import { loadCatalogFile } from "@trailroom/pipeline";
import sharp from "sharp";
import { err, ok, type Result } from "./http";

/** Long side of every image served for an ask, in pixels. */
export const ASK_IMAGE_LONG_SIDE = 1200;
export type AskImageSource = "render" | "label";

/** The pose set (and the job it was frozen with) to show for a piece, or null for the label. */
async function liveFrontSet(
  ask: AskDoc,
  itemId: string,
): Promise<{ id: string; jobId: string } | null> {
  const id = ask.poseSetIds[itemId];
  const frozenJob = ask.poseSetJobIds?.[itemId];
  // Asks from before the job id was frozen have none, and show the label photograph.
  if (!id || !frozenJob) return null;
  try {
    const set = await getPoseSet(id);
    if (
      !set ||
      set.uid !== ask.uid ||
      set.itemId !== itemId ||
      // The id is deterministic, so a removed and re-rendered try-on reuses it: only the very
      // render the asker chose is shown.
      set.jobId !== frozenJob ||
      (set.status !== "complete" && set.status !== "complete_partial") ||
      !set.poses.includes("front")
    )
      return null;
    // A render made from a photo the person has since removed is withdrawn too.
    if (!(await getPhoto(ask.uid, set.photoId))) return null;
    return (await renderExists(ask.uid, id, "front"))
      ? { id, jobId: frozenJob }
      : null;
  } catch {
    return null;
  }
}

/** Which kind of image a piece shows, without reading any bytes. */
/** Which kind of image a piece shows, without reading any bytes. */
export async function askImageSource(
  ask: AskDoc,
  itemId: string,
): Promise<AskImageSource> {
  return (await liveFrontSet(ask, itemId)) ? "render" : "label";
}

const shrink = (input: Buffer) =>
  sharp(input)
    .rotate()
    .resize({
      width: ASK_IMAGE_LONG_SIDE,
      height: ASK_IMAGE_LONG_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 82 })
    .toBuffer();

type Served = { bytes: Buffer; contentType: string; source: AskImageSource };

/**
 * Re-encoded bytes kept in this process so a repeat request skips the storage download and the
 * re-encode. Callers check the ask is live and the set is still the frozen one BEFORE looking
 * here, and the render key carries the job id, so a removed or re-rendered try-on is never served
 * from it. Oldest-used entries go first.
 */
const CACHE_MAX = 40;
const cache = new Map<string, Served>();
const cacheGet = (key: string) => {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
  }
  return hit;
};
const cachePut = (key: string, value: Served) => {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
};
/** For tests. */
export const clearAskImageCache = () => cache.clear();

export async function askImage(
  ask: AskDoc,
  itemId: string,
): Promise<Result<Served>> {
  const item = ask.itemIds.includes(itemId) ? getItem(itemId) : undefined;
  if (!item) return err("not_found");
  try {
    const live = await liveFrontSet(ask, itemId);
    if (live) {
      const key = `render|${ask.uid}|${live.id}|${live.jobId}`;
      const hit = cacheGet(key);
      if (hit) return ok(hit);
      const obj = await getRender(ask.uid, live.id, "front");
      if (obj) {
        const served: Served = {
          bytes: await shrink(obj.data),
          contentType: "image/jpeg",
          source: "render",
        };
        cachePut(key, served);
        return ok(served);
      }
    }
    const key = `label|${item.photos[0]!.file}`;
    const hit = cacheGet(key);
    if (hit) return ok(hit);
    const label = await loadCatalogFile(item.photos[0]!.file);
    if (!label) return err("not_found");
    const served: Served = {
      bytes: await shrink(label.data),
      contentType: "image/jpeg",
      source: "label",
    };
    cachePut(key, served);
    return ok(served);
  } catch {
    return err("not_found");
  }
}

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

/** The pose set to show for a piece, or null to fall back to the label's photograph. */
async function liveFrontSet(
  ask: AskDoc,
  itemId: string,
): Promise<string | null> {
  const id = ask.poseSetIds[itemId];
  if (!id) return null;
  try {
    const set = await getPoseSet(id);
    if (
      !set ||
      set.uid !== ask.uid ||
      set.itemId !== itemId ||
      (set.status !== "complete" && set.status !== "complete_partial") ||
      !set.poses.includes("front")
    )
      return null;
    // A render made from a photo the person has since removed is withdrawn too.
    if (!(await getPhoto(ask.uid, set.photoId))) return null;
    return (await renderExists(ask.uid, id, "front")) ? id : null;
  } catch {
    return null;
  }
}

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

export async function askImage(
  ask: AskDoc,
  itemId: string,
): Promise<
  Result<{ bytes: Buffer; contentType: string; source: AskImageSource }>
> {
  const item = ask.itemIds.includes(itemId) ? getItem(itemId) : undefined;
  if (!item) return err("not_found");
  try {
    const setId = await liveFrontSet(ask, itemId);
    if (setId) {
      const obj = await getRender(ask.uid, setId, "front");
      if (obj)
        return ok({
          bytes: await shrink(obj.data),
          contentType: "image/jpeg",
          source: "render" as const,
        });
    }
    const label = await loadCatalogFile(item.photos[0]!.file);
    if (!label) return err("not_found");
    return ok({
      bytes: await shrink(label.data),
      contentType: "image/jpeg",
      source: "label" as const,
    });
  } catch {
    return err("not_found");
  }
}

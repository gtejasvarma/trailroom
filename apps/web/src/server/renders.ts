// The image proxy. It reads only through getRender (the published-renders prefix); no other
// stored object can be reached from here.
//
// Account to open (PRD 22.1 rows 4 and 22): a guest owner may fetch only the tile variant; the
// full image goes to a signed-in (non-anonymous) owner. Everyone else gets 404, so ids cannot be
// probed, and a failed set serves nothing at either size.
import { getPoseSet, getRender } from "@trailroom/db";
import sharp from "sharp";
import { err, ok, type Result } from "./http";
import type { User } from "./auth";

export type RenderSize = "tile" | "full";
/** Long side of the tile variant, in pixels. */
export const TILE_LONG_SIDE = 320;

export function parseSize(raw: string | null): RenderSize | null {
  if (raw === null || raw === "" || raw === "full") return "full";
  return raw === "tile" ? "tile" : null;
}

async function tileOf(full: Buffer): Promise<Buffer> {
  return sharp(full)
    .rotate()
    .resize({
      width: TILE_LONG_SIDE,
      height: TILE_LONG_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 78 })
    .toBuffer();
}

export async function getRenderForUser(
  user: User,
  poseSetId: string,
  pose: string,
  size: RenderSize = "full",
): Promise<Result<{ bytes: Buffer; contentType: string }>> {
  try {
    const set = await getPoseSet(poseSetId);
    if (
      !set ||
      set.uid !== user.uid ||
      set.status === "failed" ||
      !set.poses.includes(pose)
    ) {
      return err("not_found");
    }
    if (user.isGuest && size !== "tile") return err("account_required");
    const obj = await getRender(user.uid, poseSetId, pose);
    if (!obj) return err("not_found");
    const bytes = size === "tile" ? await tileOf(obj.data) : obj.data;
    return ok({ bytes, contentType: "image/jpeg" });
  } catch {
    return err("not_found"); // invalid path segments
  }
}

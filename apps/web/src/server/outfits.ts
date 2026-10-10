// Phase F: an outfit is two pieces on one photo, rendered as one Front image. It runs the same
// graph, the same QA gate and the same limits as a try-on (launchRender); only the refusals that
// are about the pair itself live here.
import {
  getDefaultPhotoId,
  kindOf,
  listPoseSetsForUser,
  getPhoto,
  isConsentCurrent,
  outfitPoseSetId,
} from "@trailroom/db";
import {
  canonicalOutfitIds,
  closestThree,
  getItem,
  isOutfitPair,
  isRenderReady,
} from "@trailroom/catalog";
import { OUTFIT_PROMPT_VERSION } from "@trailroom/render";
import { CONSENT_VERSION } from "../lib/consent";
import { err, ok, type Result } from "./http";
import { launchRender, type TryOnBody } from "./tryon";
import type { User } from "./auth";

/** An outfit is the Front view only: "Both pieces, one render". */
export const OUTFIT_POSES = ["front"];

const validId = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 100;

export async function startOutfit(
  user: User,
  input: unknown,
  now: Date = new Date(),
): Promise<Result<TryOnBody>> {
  const body = (input ?? {}) as { itemIds?: unknown; photoId?: unknown };
  const ids = body.itemIds;
  if (
    !Array.isArray(ids) ||
    ids.length !== 2 ||
    !ids.every(validId) ||
    ids[0] === ids[1]
  ) {
    return err("invalid_request");
  }
  if (body.photoId !== undefined && !validId(body.photoId)) {
    return err("invalid_request");
  }
  // A guest cannot open renders, so an outfit (which only exists to be opened) is for accounts.
  if (user.isGuest) return err("account_required");

  // Every refusal below happens before any reservation or model call.
  if (!(await isConsentCurrent(user.uid, CONSENT_VERSION))) {
    return err("consent_required");
  }
  const photoId = body.photoId ?? (await getDefaultPhotoId(user.uid));
  if (!photoId) return err("photo_required");
  let photo;
  try {
    photo = await getPhoto(user.uid, photoId as string);
  } catch {
    return err("not_found");
  }
  if (!photo)
    return err(body.photoId === undefined ? "photo_required" : "not_found");

  const items = ids.map((id) => getItem(id));
  if (items.some((i) => !i)) return err("unknown_item");
  for (const item of items) {
    if (!isRenderReady(item!)) {
      return err("not_ready", {
        reasons: item!.readinessReasons,
        closest: closestThree(item!.id).map((i) => i.id),
      });
    }
  }
  if (!isOutfitPair(ids[0]!, ids[1]!)) return err("invalid_outfit");

  const pair = canonicalOutfitIds(ids[0]!, ids[1]!);
  return launchRender(
    user,
    {
      kind: "outfit",
      psId: outfitPoseSetId(user.uid, photo.id, pair[0], pair[1]),
      photoId: photo.id,
      itemId: pair[0],
      itemIds: pair,
      poses: OUTFIT_POSES,
      promptVersion: OUTFIT_PROMPT_VERSION,
    },
    now,
  );
}

export interface OutfitSummary {
  poseSetId: string;
  jobId: string;
  /** Both pieces, canonical order. */
  itemIds: [string, string];
  photoId: string;
  status: "complete" | "complete_partial";
  poses: string[];
  createdAt: string;
}

/** GET /api/outfits: the caller's finished outfits, newest first. Nobody else's. */
export async function listOutfits(
  user: User,
): Promise<Result<{ outfits: OutfitSummary[] }>> {
  const sets = await listPoseSetsForUser(user.uid);
  return ok({
    outfits: sets
      .filter(
        (s) =>
          s.poseSet.uid === user.uid &&
          kindOf(s.poseSet) === "outfit" &&
          s.poseSet.itemIds?.length === 2 &&
          (s.poseSet.status === "complete" ||
            s.poseSet.status === "complete_partial") &&
          s.poseSet.poses.includes("front"),
      )
      .reverse()
      .map((s) => ({
        poseSetId: s.id,
        jobId: s.poseSet.jobId,
        itemIds: s.poseSet.itemIds as [string, string],
        photoId: s.poseSet.photoId,
        status: s.poseSet.status as "complete" | "complete_partial",
        poses: ["front"],
        createdAt: s.poseSet.createdAt.toDate().toISOString(),
      })),
  });
}

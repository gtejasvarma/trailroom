import {
  getFollows,
  countPhotos,
  getDefaultPhotoId,
  isConsentCurrent,
  listPoseSetsForUser,
} from "@trailroom/db";
import { CONSENT_VERSION } from "../lib/consent";
import { ok, type Result } from "./http";
import type { User } from "./auth";

export interface MeBody {
  uid: string;
  isGuest: boolean;
  consented: boolean;
  photoCount: number;
  defaultPhotoId: string | null;
  /** Slugs of the labels this session follows. */
  follows: string[];
  /** Pose sets that are not failed, for any of the person's photos. */
  activePoseSets: {
    poseSetId: string;
    itemId: string;
    jobId: string;
    status: string;
  }[];
}

export async function getMe(user: User): Promise<Result<MeBody>> {
  const [consent, photoCount, defaultPhotoId, sets, follows] =
    await Promise.all([
      isConsentCurrent(user.uid, CONSENT_VERSION),
      countPhotos(user.uid),
      getDefaultPhotoId(user.uid),
      listPoseSetsForUser(user.uid),
      getFollows(user.uid),
    ]);
  return ok({
    uid: user.uid,
    isGuest: user.isGuest,
    consented: consent,
    photoCount,
    defaultPhotoId,
    follows,
    activePoseSets: sets
      .filter((s) => s.poseSet.status !== "failed")
      .map((s) => ({
        poseSetId: s.id,
        itemId: s.poseSet.itemId,
        jobId: s.poseSet.jobId,
        status: s.poseSet.status,
      })),
  });
}

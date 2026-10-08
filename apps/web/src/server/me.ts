import {
  getFollows,
  getPhoto,
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
  hasPhoto: boolean;
  /** 0 when there is no photo. */
  identityVersion: number;
  /** Slugs of the labels this session follows. */
  follows: string[];
  /** Pose sets for the current photo that are not failed. */
  activePoseSets: {
    poseSetId: string;
    itemId: string;
    jobId: string;
    status: string;
  }[];
}

export async function getMe(user: User): Promise<Result<MeBody>> {
  const [consent, photo, sets, follows] = await Promise.all([
    isConsentCurrent(user.uid, CONSENT_VERSION),
    getPhoto(user.uid),
    listPoseSetsForUser(user.uid),
    getFollows(user.uid),
  ]);
  const iv = photo?.identityVersion ?? 0;
  return ok({
    uid: user.uid,
    isGuest: user.isGuest,
    consented: consent,
    hasPhoto: photo !== null,
    identityVersion: iv,
    follows,
    activePoseSets: sets
      .filter(
        (s) =>
          photo &&
          s.poseSet.identityVersion === iv &&
          s.poseSet.status !== "failed",
      )
      .map((s) => ({
        poseSetId: s.id,
        itemId: s.poseSet.itemId,
        jobId: s.poseSet.jobId,
        status: s.poseSet.status,
      })),
  });
}

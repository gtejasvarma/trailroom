import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firestore } from "./app";
import { assertSegment } from "./paths";
import type { FollowsDoc } from "./types";

const ref = (uid: string) =>
  firestore().collection("follows").doc(assertSegment("uid", uid));

/** The label slugs this user follows, sorted. Empty when they follow none. */
export async function getFollows(uid: string): Promise<string[]> {
  const snap = await ref(uid).get();
  const labels = (snap.data() as FollowsDoc | undefined)?.labels ?? [];
  return [...labels].sort();
}

/** Idempotent: following twice, or unfollowing a label never followed, changes nothing. */
export async function setFollow(
  uid: string,
  labelSlug: string,
  follow: boolean,
): Promise<string[]> {
  assertSegment("labelSlug", labelSlug);
  await ref(uid).set(
    {
      labels: follow
        ? FieldValue.arrayUnion(labelSlug)
        : FieldValue.arrayRemove(labelSlug),
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );
  return getFollows(uid);
}

export async function deleteFollows(uid: string): Promise<void> {
  await ref(uid).delete();
}

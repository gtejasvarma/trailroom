import { beforeEach, describe, expect, it } from "vitest";
import { Timestamp } from "firebase-admin/firestore";
import { auth, firestore } from "./app";
import { clearFirestore } from "./emu-helpers";
import { mergeGuestInto } from "./merge";
import { addPhoto, getDefaultPhotoId, listPhotos } from "./photos";
import { getPoseSet, poseSetId } from "./poseSets";
import { createJob, getJob } from "./jobs";
import { getRender, getPhotoBytes, publishRender, putPhoto } from "./storage";
import { getConsent, recordConsent } from "./consent";
import { getFollows, setFollow } from "./follows";
import { deleteAllForUser, listExpiredGuestUids } from "./users";
import { MAX_PHOTOS } from "./types";

const G = "guest1";
const A = "acct1";

beforeEach(async () => {
  await clearFirestore();
  for (const uid of [G, A])
    await auth()
      .deleteUser(uid)
      .catch(() => {});
  await auth().createUser({ uid: G });
  await auth().createUser({ uid: A });
});

async function guestTryOn(
  photoId: string,
  itemId: string,
  status = "complete",
) {
  const pose = ["front", "walking"];
  const { id: jobId } = await createJob({
    uid: G,
    itemId,
    photoId,
    poseSetId: poseSetId(G, photoId, itemId),
    poses: {},
    poseOrder: pose,
    qaSkipped: [],
    model: "fake",
    promptVersion: "p",
    isGuest: true,
  });
  const id = poseSetId(G, photoId, itemId);
  await firestore()
    .collection("poseSets")
    .doc(id)
    .set({
      uid: G,
      itemId,
      photoId,
      jobId,
      status,
      poses: status === "rendering" ? [] : pose,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 1e6),
    });
  if (status !== "rendering")
    for (const p of pose) await publishRender(G, id, p, Buffer.from(`r-${p}`));
  return { jobId, id };
}

async function guestPhoto(n: number) {
  const { photo } = await addPhoto(G, {
    width: 800,
    height: 1100,
    isGuest: true,
    photoId: `ph${n}`,
  });
  await putPhoto(G, photo.id, Buffer.from(`photo-${n}`));
  return photo.id;
}

describe("mergeGuestInto", () => {
  it("moves photo, pose set, renders and job; keeps the job id; deletes the guest", async () => {
    const pid = await guestPhoto(1);
    const { jobId, id } = await guestTryOn(pid, "item-a");
    await recordConsent(G, "v1");
    await setFollow(G, "label-x", true);
    await setFollow(A, "label-y", true);

    const r = await mergeGuestInto(G, A);
    const newId = poseSetId(A, pid, "item-a");
    expect(r).toEqual({
      photos: 1,
      tryOns: [{ jobId, poseSetId: newId, itemId: "item-a" }],
      follows: 1,
    });

    expect(
      (await listPhotos(A)).map((p) => [p.id, p.isGuest, p.expiresAt]),
    ).toEqual([[pid, false, null]]);
    expect(await getDefaultPhotoId(A)).toBe(pid);
    expect((await getPhotoBytes(A, pid))?.data.toString()).toBe("photo-1");
    const set = await getPoseSet(newId);
    expect(set).toMatchObject({
      uid: A,
      jobId,
      status: "complete",
      expiresAt: null,
    });
    for (const p of ["front", "walking"])
      expect((await getRender(A, newId, p))?.data.toString()).toBe(`r-${p}`);
    expect(await getJob(jobId)).toMatchObject({
      uid: A,
      poseSetId: newId,
      isGuest: false,
      expiresAt: null,
    });
    expect((await getConsent(A))?.version).toBe("v1");
    expect(await getFollows(A)).toEqual(["label-x", "label-y"]);

    // Guest side is gone.
    expect(await getPoseSet(id)).toBeNull();
    expect(await getRender(G, id, "front")).toBeNull();
    expect(await getPhotoBytes(G, pid)).toBeNull();
    expect(await listPhotos(G)).toEqual([]);
    expect(await getConsent(G)).toBeNull();
    expect(await getFollows(G)).toEqual([]);
    await expect(auth().getUser(G)).rejects.toMatchObject({
      code: "auth/user-not-found",
    });
  });

  it("a second run changes nothing and does not fail", async () => {
    const pid = await guestPhoto(1);
    await guestTryOn(pid, "item-a");
    await mergeGuestInto(G, A);
    const again = await mergeGuestInto(G, A);
    expect(again).toEqual({ photos: 0, tryOns: [], follows: 0 });
    expect(await listPhotos(A)).toHaveLength(1);
    expect(await getPoseSet(poseSetId(A, pid, "item-a"))).not.toBeNull();
  });

  it("a retry after a crash before the deletes finishes the job", async () => {
    const pid = await guestPhoto(1);
    const { jobId } = await guestTryOn(pid, "item-a");
    await mergeGuestInto(G, A);
    // Put the guest's copy back, as if the deletes never ran.
    await auth().createUser({ uid: G });
    await guestPhoto(1);
    const { id } = await guestTryOn(pid, "item-a");
    await firestore().collection("jobs").doc(jobId).update({ uid: G });
    await firestore().collection("poseSets").doc(id).update({ jobId });
    const r = await mergeGuestInto(G, A);
    expect(r.tryOns.map((t) => t.jobId)).toEqual([jobId]);
    expect((await getJob(jobId))?.uid).toBe(A);
    expect(await getPoseSet(id)).toBeNull();
  });

  it("does not move a rendering set or its photo", async () => {
    const pid = await guestPhoto(1);
    const { id } = await guestTryOn(pid, "item-a", "rendering");
    const r = await mergeGuestInto(G, A);
    expect(r.tryOns).toEqual([]);
    expect(await getPoseSet(id)).not.toBeNull();
    expect(await getPhotoBytes(G, pid)).not.toBeNull();
    expect(await getPoseSet(poseSetId(A, pid, "item-a"))).toBeNull();
  });

  it("respects the photo cap, try-on photos first; keeps the account's default", async () => {
    const have: string[] = [];
    for (let i = 0; i < MAX_PHOTOS - 1; i++) {
      const { photo } = await addPhoto(A, {
        width: 800,
        height: 1100,
        isGuest: false,
        photoId: `own${i}`,
      });
      have.push(photo.id);
    }
    await guestPhoto(1);
    const backing = await guestPhoto(2);
    await guestTryOn(backing, "item-a");
    const r = await mergeGuestInto(G, A);
    expect(r.photos).toBe(1);
    expect(r.tryOns).toHaveLength(1);
    const ids = (await listPhotos(A)).map((p) => p.id);
    expect(ids).toHaveLength(MAX_PHOTOS);
    expect(ids).toContain(backing);
    expect(ids).not.toContain("ph1");
    expect(await getDefaultPhotoId(A)).toBe("own0");
    // The excess stays with the guest for the purge.
    expect(await getPhotoBytes(G, "ph1")).not.toBeNull();
  });

  it("keeps the account's own finished set for the same photo and piece", async () => {
    const pid = await guestPhoto(1);
    const { jobId } = await guestTryOn(pid, "item-a");
    await mergeGuestInto(G, A); // sets it up on the account
    await auth().createUser({ uid: G });
    await guestPhoto(1);
    const second = await guestTryOn(pid, "item-a");
    const r = await mergeGuestInto(G, A);
    expect(r.tryOns).toEqual([]);
    expect((await getPoseSet(poseSetId(A, pid, "item-a")))?.jobId).toBe(jobId);
    expect((await getJob(second.jobId))?.uid).toBe(G);
  });

  it("rejects bad ids and self-merge", async () => {
    await expect(mergeGuestInto(G, G)).rejects.toThrow();
    await expect(mergeGuestInto("../x", A)).rejects.toThrow();
    await expect(mergeGuestInto(G, "a/b")).rejects.toThrow();
  });

  it("purge still runs on what is left, with the guest's Auth user gone", async () => {
    const pid = await guestPhoto(1);
    await guestTryOn(pid, "item-a", "rendering");
    await mergeGuestInto(G, A);
    // Force the leftover to be expired and purge it.
    await firestore()
      .collection("photos")
      .doc(G)
      .update({ expiresAt: Timestamp.fromMillis(1) });
    expect(await listExpiredGuestUids(new Date())).toEqual([G]);
    await deleteAllForUser(G);
    expect(await getPhotoBytes(G, pid)).toBeNull();
    expect(await listPhotos(G)).toEqual([]);
  });
});

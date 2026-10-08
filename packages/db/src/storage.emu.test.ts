import { beforeEach, describe, expect, it } from "vitest";
import { clearFirestore } from "./emu-helpers";
import { bucket } from "./app";
import { createJob } from "./jobs";
import { claimPoseSet } from "./poseSets";
import { getConsent, recordConsent } from "./consent";
import { getPhoto, savePhoto } from "./photos";
import {
  deleteRender,
  deleteStagingForJob,
  getPhotoBytes,
  getRender,
  getStaging,
  publishRender,
  putPhoto,
  putStaging,
} from "./storage";
import { deleteAllForUser } from "./users";

beforeEach(clearFirestore);

const buf = (s: string) => Buffer.from(s);

describe("storage helpers", () => {
  it("round-trips photo, staging and render", async () => {
    await putPhoto("u1", buf("photo"), "image/jpeg");
    expect((await getPhotoBytes("u1"))!.data.toString()).toBe("photo");

    await putStaging("j1", "front", 1, buf("raw"), "image/png");
    const s = await getStaging("j1", "front", 1);
    expect(s!.data.toString()).toBe("raw");
    expect(await getStaging("j1", "front", 2)).toBeNull();

    await publishRender("u1", "u1_1_g", "front", buf("final"));
    expect((await getRender("u1", "u1_1_g", "front"))!.data.toString()).toBe(
      "final",
    );

    await deleteRender("u1", "u1_1_g", "front");
    expect(await getRender("u1", "u1_1_g", "front")).toBeNull();
    await deleteStagingForJob("j1");
    expect(await getStaging("j1", "front", 1)).toBeNull();
  });

  it("deleteAllForUser removes that user's data and leaves another's", async () => {
    for (const uid of ["u1", "u2"]) {
      await recordConsent(uid, "v");
      await savePhoto(uid, { width: 1, height: 1, isGuest: false });
      await putPhoto(uid, buf("p"), "image/jpeg");
      const id = `${uid}_1_g-parka`;
      await claimPoseSet({
        uid,
        itemId: "g-parka",
        identityVersion: 1,
        jobId: "x",
        isGuest: false,
      });
      await publishRender(uid, id, "front", buf("r"));
      const { id: jobId } = await createJob({
        uid,
        itemId: "g-parka",
        identityVersion: 1,
        poseSetId: id,
        poseOrder: [],
        poses: {},
        qaSkipped: [],
        model: "m",
        promptVersion: "p",
        isGuest: false,
      });
      await putStaging(jobId, "front", 1, buf("s"), "image/png");
    }
    await deleteAllForUser("u1");

    expect(await getConsent("u1")).toBeNull();
    expect(await getPhoto("u1")).toBeNull();
    expect(await getPhotoBytes("u1")).toBeNull();
    expect(await getRender("u1", "u1_1_g-parka", "front")).toBeNull();
    const [staging] = await bucket().getFiles({ prefix: "staging/" });
    expect(staging).toHaveLength(1);
    const db = (await import("./app")).firestore();
    expect(
      (await db.collection("jobs").where("uid", "==", "u1").get()).size,
    ).toBe(0);
    expect(
      (await db.collection("poseSets").where("uid", "==", "u1").get()).size,
    ).toBe(0);

    expect(await getConsent("u2")).not.toBeNull();
    expect(await getPhoto("u2")).not.toBeNull();
    expect(await getPhotoBytes("u2")).not.toBeNull();
    expect(await getRender("u2", "u2_1_g-parka", "front")).not.toBeNull();
    expect(
      (await db.collection("jobs").where("uid", "==", "u2").get()).size,
    ).toBe(1);
    expect(
      (await db.collection("poseSets").where("uid", "==", "u2").get()).size,
    ).toBe(1);
  });
});

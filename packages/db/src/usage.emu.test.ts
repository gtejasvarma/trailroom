import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import { bucket, firestore } from "./app";
import { clearFirestore } from "./emu-helpers";
import {
  isConsentCurrent,
  listStaleConsentUids,
  recordConsent,
} from "./consent";
import { createJob, setAttemptRecord, updateJob } from "./jobs";
import { getJobInternal } from "./jobInternals";
import { claimPoseSet, poseSetId } from "./poseSets";
import { savePhoto } from "./photos";
import { putPhoto } from "./storage";
import { deleteAllForUser } from "./users";
import {
  claimDailyStart,
  DailyLimitError,
  deleteOldUsage,
  getUsage,
  GuestLiveSetError,
} from "./usage";
import { GUEST_TTL_MS } from "./types";

beforeEach(clearFirestore);

const at = (s: string) => new Date(s);

describe("claimDailyStart", () => {
  it("throws DailyLimitError at the limit and rolls over at UTC midnight", async () => {
    const t1 = at("2026-03-01T23:59:00Z");
    await claimDailyStart("u1", 2, t1);
    await claimDailyStart("u1", 2, t1);
    await expect(claimDailyStart("u1", 2, t1)).rejects.toBeInstanceOf(
      DailyLimitError,
    );
    await claimDailyStart("u1", 2, at("2026-03-02T00:01:00Z"));
    expect((await getUsage("u1", t1))!.starts).toBe(2);
    expect((await getUsage("u1", at("2026-03-02T00:01:00Z")))!.starts).toBe(1);
  });

  it("concurrent claims never exceed the limit", async () => {
    const t = at("2026-03-01T10:00:00Z");
    const r = await Promise.allSettled(
      Array.from({ length: 8 }, () => claimDailyStart("u2", 5, t)),
    );
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(5);
    expect((await getUsage("u2", t))!.starts).toBe(5);
  });

  it("a guest cannot hold two live sets: concurrent claims admit one", async () => {
    const t = at("2026-03-01T10:00:00Z");
    const r = await Promise.allSettled([
      claimDailyStart("g1", 2, t, { poseSetId: "g1_1_a" }),
      claimDailyStart("g1", 2, t, { poseSetId: "g1_1_b" }),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const bad = r.find((x) => x.status === "rejected") as PromiseRejectedResult;
    expect(bad.reason).toBeInstanceOf(GuestLiveSetError);
  });

  it("a failed set frees the guest claim but still counts toward the limit", async () => {
    const t = at("2026-03-01T10:00:00Z");
    await claimDailyStart("g2", 2, t, { poseSetId: "g2_1_a" });
    await firestore().collection("poseSets").doc("g2_1_a").set({
      uid: "g2",
      status: "failed",
    });
    await claimDailyStart("g2", 2, t, { poseSetId: "g2_1_b" });
    await firestore().collection("poseSets").doc("g2_1_b").set({
      uid: "g2",
      status: "failed",
    });
    await expect(
      claimDailyStart("g2", 2, t, { poseSetId: "g2_1_c" }),
    ).rejects.toBeInstanceOf(DailyLimitError);
  });

  it("deleteOldUsage removes only usage older than 3 days; deleteAllForUser keeps usage", async () => {
    const now = at("2026-03-10T12:00:00Z");
    await claimDailyStart("u3", 5, at("2026-03-01T10:00:00Z"));
    await claimDailyStart("u3", 5, at("2026-03-09T10:00:00Z"));
    await recordConsent("u3", "v1");
    await deleteAllForUser("u3");
    expect(await getUsage("u3", at("2026-03-09T10:00:00Z"))).not.toBeNull();
    expect(await deleteOldUsage(now)).toBe(1);
    expect(await getUsage("u3", at("2026-03-01T10:00:00Z"))).toBeNull();
    expect(await getUsage("u3", at("2026-03-09T10:00:00Z"))).not.toBeNull();
  });
});

describe("consent helpers", () => {
  it("isConsentCurrent compares the version", async () => {
    await recordConsent("c1", "v-old");
    expect(await isConsentCurrent("c1", "v-old")).toBe(true);
    expect(await isConsentCurrent("c1", "v-new")).toBe(false);
    expect(await isConsentCurrent("nobody", "v-new")).toBe(false);
  });

  it("listStaleConsentUids: old consent with no photo only", async () => {
    const now = new Date();
    const old = Timestamp.fromMillis(now.getTime() - GUEST_TTL_MS - 60_000);
    const mk = (uid: string, acceptedAt: Timestamp) =>
      firestore()
        .collection("consents")
        .doc(uid)
        .set({ version: "v1", acceptedAt, ageAttested18: true });
    await mk("stale-no-photo", old);
    await mk("stale-with-photo", old);
    await mk("fresh", Timestamp.fromDate(now));
    await savePhoto("stale-with-photo", {
      width: 1,
      height: 1,
      isGuest: true,
    });
    expect(await listStaleConsentUids(now)).toEqual(["stale-no-photo"]);
  });
});

describe("deleteAllForUser", () => {
  it("chunks past 400 docs, removes jobInternals and objects", async () => {
    const uid = "big";
    await recordConsent(uid, "v1");
    await putPhoto(uid, Buffer.from("x"));
    const ids: string[] = [];
    const db = firestore();
    for (let i = 0; i < 3; i++) {
      const batch = db.batch();
      for (let k = 0; k < 250; k++) {
        const ref = db.collection("poseSets").doc(`${uid}_${i}_${k}`);
        batch.set(ref, { uid });
        ids.push(ref.id);
      }
      await batch.commit();
    }
    const { id } = await createJob({
      uid,
      itemId: "g-parka",
      identityVersion: 1,
      poseSetId: poseSetId(uid, 1, "g-parka"),
      poseOrder: ["front"],
      poses: { front: { status: "pending", attempt: 0, reasons: [] } },
      qaSkipped: [],
      model: "m",
      promptVersion: "p",
      isGuest: false,
    });
    await claimPoseSet({
      uid,
      itemId: "g-parka",
      identityVersion: 1,
      jobId: id,
      isGuest: false,
    });
    await setAttemptRecord(id, "front", 1, { outcome: "blocked", detail: "d" });
    await updateJob(id, { failure: { code: "internal", detail: "x" } });
    await bucket().file(`staging/${id}/front-1.png`).save(Buffer.from("x"));
    await deleteAllForUser(uid);
    expect(
      (await db.collection("poseSets").where("uid", "==", uid).get()).size,
    ).toBe(0);
    expect(await getJobInternal(id)).toBeNull();
    const [files] = await bucket().getFiles({ prefix: `staging/${id}/` });
    expect(files).toHaveLength(0);
  });
});

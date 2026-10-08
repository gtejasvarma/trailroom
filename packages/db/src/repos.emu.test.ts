import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import { clearFirestore } from "./emu-helpers";
import {
  createJob,
  getJob,
  listExpiredGuestJobs,
  setPoseState,
  updateJob,
} from "./jobs";
import {
  claimPoseSet,
  countPoseSetsForUser,
  PoseSetExistsError,
  poseSetId,
} from "./poseSets";
import { getConsent, recordConsent } from "./consent";
import { getPhoto, savePhoto } from "./photos";
import { getFollows, setFollow } from "./follows";
import { deleteAllForUser } from "./users";
import { GUEST_TTL_MS } from "./types";
import type { NewJob } from "./jobs";

beforeEach(clearFirestore);

const base = (over: Partial<NewJob> = {}): NewJob => ({
  uid: "u1",
  itemId: "blouse",
  identityVersion: 1,
  poseSetId: "u1_1_blouse",
  poseOrder: ["front", "side"],
  poses: {
    front: { status: "pending", attempt: 0, reasons: [] },
    side: { status: "pending", attempt: 0, reasons: [] },
  },
  qaSkipped: [],
  model: "m",
  promptVersion: "edit-v1",
  isGuest: false,
  ...over,
});

describe("pose sets", () => {
  it("second claim for the same key throws PoseSetExistsError with the first doc", async () => {
    const input = {
      uid: "u1",
      itemId: "blouse",
      identityVersion: 1,
      jobId: "job-a",
      isGuest: false,
    };
    const first = await claimPoseSet(input);
    expect(first.id).toBe(poseSetId("u1", 1, "blouse"));
    const err = await claimPoseSet({ ...input, jobId: "job-b" }).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(PoseSetExistsError);
    expect(err.existing.jobId).toBe("job-a");
    expect(await countPoseSetsForUser("u1")).toBe(1);
    expect(await countPoseSetsForUser("nobody")).toBe(0);
  });
});

describe("jobs", () => {
  it("two concurrent setPoseState calls on different poses both persist", async () => {
    const { id } = await createJob(base());
    await Promise.all([
      setPoseState(id, "front", { status: "passed", attempt: 1 }),
      setPoseState(id, "side", {
        status: "failed",
        attempt: 2,
        reasons: ["blank"],
      }),
    ]);
    const job = await getJob(id);
    expect(job!.poses.front).toEqual({
      status: "passed",
      attempt: 1,
      reasons: [],
    });
    expect(job!.poses.side).toEqual({
      status: "failed",
      attempt: 2,
      reasons: ["blank"],
    });
  });

  it("updateJob patches and bumps updatedAt", async () => {
    const t0 = new Date("2026-01-01T00:00:00Z");
    const { id } = await createJob(base(), t0);
    await updateJob(id, { status: "failed", failure: { code: "capacity" } });
    const job = await getJob(id);
    expect(job!.status).toBe("failed");
    expect(job!.failure).toEqual({ code: "capacity" });
    expect(job!.updatedAt.toMillis()).toBeGreaterThan(t0.getTime());
  });

  it("listExpiredGuestJobs returns only guest jobs past expiresAt", async () => {
    const now = new Date("2026-02-10T00:00:00Z");
    const old = new Date(now.getTime() - GUEST_TTL_MS - 1000);
    const fresh = new Date(now.getTime() - 1000);
    const a = await createJob(base({ isGuest: true }), old);
    await createJob(base({ isGuest: true }), fresh);
    await createJob(base({ isGuest: false }), old);
    const out = await listExpiredGuestJobs(now);
    expect(out.map((j) => j.id)).toEqual([a.id]);
    expect(a.job.expiresAt).toEqual(
      Timestamp.fromMillis(old.getTime() + GUEST_TTL_MS),
    );
  });
});

describe("consent and photo", () => {
  it("records consent and increments identityVersion", async () => {
    expect(await getConsent("u1")).toBeNull();
    await recordConsent("u1", "2026-01");
    expect((await getConsent("u1"))!.ageAttested18).toBe(true);
    const p1 = await savePhoto("u1", { width: 10, height: 20, isGuest: true });
    const p2 = await savePhoto("u1", { width: 10, height: 20, isGuest: true });
    expect([p1.identityVersion, p2.identityVersion]).toEqual([1, 2]);
    expect((await getPhoto("u1"))!.expiresAt).not.toBeNull();
  });
});

describe("follows", () => {
  it("follow and unfollow are idempotent and per user", async () => {
    expect(await getFollows("u1")).toEqual([]);
    expect(await setFollow("u1", "marchand", true)).toEqual(["marchand"]);
    expect(await setFollow("u1", "marchand", true)).toEqual(["marchand"]);
    await setFollow("u1", "cyra", true);
    expect(await getFollows("u1")).toEqual(["cyra", "marchand"]);
    expect(await getFollows("u2")).toEqual([]);
    expect(await setFollow("u1", "marchand", false)).toEqual(["cyra"]);
    expect(await setFollow("u1", "marchand", false)).toEqual(["cyra"]);
    await deleteAllForUser("u1");
    expect(await getFollows("u1")).toEqual([]);
  });
  it("refuses a slug that could escape the path", async () => {
    await expect(setFollow("u1", "../x", true)).rejects.toThrow();
  });
});

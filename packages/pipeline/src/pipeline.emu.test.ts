import sharp from "sharp";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clearFirestore } from "../../db/src/emu-helpers";
import { getItem } from "@trailroom/catalog";
import {
  bucket,
  firestore,
  FirestoreDailyLedger,
  updateJob,
  getJob,
  getJobInternal,
  getPhotoBytes,
  getPoseSet,
  utcDay,
  type SpendDayDoc,
  type SpendLogDoc,
} from "@trailroom/db";
import {
  buildPrompt,
  estimateCostMicros,
  fakeProvider,
  GENERIC_WEARING,
  getFakeCalls,
  setFakeScript,
  usdToMicros,
  type FakeOutcome,
  type FakeRule,
  type Pose,
} from "@trailroom/render";
import { maxBlockMeanDiff } from "./blockdiff";
import { IN_FLIGHT_MS, JobTerminalError } from "./index";
import {
  failJob,
  failPose,
  finalizeSet,
  prepare,
  publishPose,
  qaPose,
  renderPose,
} from "./nodes";
import { loadItemImage } from "./catalog-images";
import { runInline } from "./inline";
import {
  clearBucket,
  jobSnapshot,
  listObjects,
  makeJob,
  POSE_LIST,
} from "./testkit";

process.env.RENDER_PROVIDER = "fake";
delete process.env.DAILY_CAP_USD;

beforeEach(async () => {
  process.env.RENDER_PROVIDER = "fake";
  delete process.env.DAILY_CAP_USD;
  setFakeScript(null);
  await clearFirestore();
  await clearBucket();
});
afterEach(() => {
  setFakeScript(null);
  delete process.env.DAILY_CAP_USD;
});

const callsFor = (pose: string) =>
  getFakeCalls().filter((c) => c.pose === pose).length;
const rendersOf = (j: { uid: string; poseSetId: string }) =>
  listObjects(`renders/${j.uid}/${j.poseSetId}/`);

async function spendLines(jobId: string): Promise<SpendLogDoc[]> {
  const snap = await firestore()
    .collection("spendLog")
    .where("jobId", "==", jobId)
    .get();
  return snap.docs.map((d) => d.data() as SpendLogDoc);
}
async function dayDoc(): Promise<SpendDayDoc> {
  const s = await firestore().collection("spend").doc(utcDay(new Date())).get();
  return s.data() as SpendDayDoc;
}

describe("runInline", () => {
  it("happy path: four poses published unmarked, books balance", async () => {
    const j = await makeJob("u-happy");
    const r = await runInline(j.jobId);
    expect(r).toEqual({ status: "complete", published: POSE_LIST });

    const job = (await getJob(j.jobId))!;
    expect(job.status).toBe("complete");
    expect(job.failure).toBeNull();
    expect(job.qaSkipped).toEqual([
      "identity",
      "proportion",
      "garment_fidelity",
      "artifacts",
      "cross_pose_consistency",
    ]);
    for (const p of POSE_LIST) expect(job.poses[p]!.status).toBe("passed");
    const ps = (await getPoseSet(j.poseSetId))!;
    expect(ps.status).toBe("complete");
    expect([...ps.poses].sort()).toEqual([...POSE_LIST].sort());

    expect(await rendersOf(j)).toHaveLength(4);
    expect(await listObjects(`staging/${j.jobId}/`)).toEqual([]);

    const lines = await spendLines(j.jobId);
    expect(lines).toHaveLength(4);
    expect(lines.every((l) => l.state === "settled")).toBe(true);
    const sum = lines.reduce((a, l) => a + l.actualMicros!, 0);
    const day = await dayDoc();
    expect(day.committedMicros).toBe(sum);
    expect(day.pendingMicros).toBe(0);
  });

  it("a pose that fails once is rendered exactly twice and passes", async () => {
    const j = await makeJob("u-retry1");
    setFakeScript([{ pose: "walking", outcome: "error", times: 1 }]);
    const r = await runInline(j.jobId);
    expect(r.status).toBe("complete");
    expect(callsFor("walking")).toBe(2);
    expect(callsFor("front")).toBe(1);
    const job = (await getJob(j.jobId))!;
    expect(job.poses.walking!.status).toBe("passed");
    expect(job.poses.walking!.attempt).toBe(2);
    expect(await rendersOf(j)).toHaveLength(4);
  });

  it("a pose that fails twice is never rendered a third time: complete_partial", async () => {
    const j = await makeJob("u-retry2");
    setFakeScript([{ pose: "walking", outcome: "blank", times: 5 }]);
    const r = await runInline(j.jobId);
    expect(r.status).toBe("complete_partial");
    expect(callsFor("walking")).toBe(2);
    const job = (await getJob(j.jobId))!;
    expect(job.status).toBe("complete_partial");
    expect(job.poses.walking!.status).toBe("failed");
    expect(job.poses.walking!.reasons).toEqual(["blank"]);
    const ps = (await getPoseSet(j.poseSetId))!;
    expect(ps.status).toBe("complete_partial");
    expect(ps.poses).toHaveLength(3);
    expect(ps.poses).not.toContain("walking");
    expect(await rendersOf(j)).toHaveLength(3);
    expect((await spendLines(j.jobId)).length).toBe(5);
  });

  it("two poses failing twice fails the set and withdraws what had passed", async () => {
    const j = await makeJob("u-failset");
    setFakeScript([
      { pose: "walking", outcome: "blank", times: 5 },
      { pose: "seated", outcome: "undersized", times: 5 },
    ]);
    const r = await runInline(j.jobId);
    expect(r).toEqual({ status: "failed", published: [] });
    expect(callsFor("walking") + callsFor("seated")).toBe(4);
    const job = (await getJob(j.jobId))!;
    expect(job.status).toBe("failed");
    expect(job.failure?.code).toBe("render_failed");
    expect(await rendersOf(j)).toEqual([]);
    expect(await listObjects(`staging/${j.jobId}/`)).toEqual([]);
    const ps = (await getPoseSet(j.poseSetId))!;
    expect(ps.status).toBe("failed");
    expect(ps.poses).toEqual([]);
  });

  const REASONS: [FakeOutcome, string][] = [
    ["undersized", "too_small"],
    ["blank", "blank"],
    ["copy_input", "copy_of_input"],
    ["blocked", "blocked"],
    ["no_image", "no_image"],
    ["error", "model_error"],
  ];
  it.each(REASONS)(
    "fake outcome %s records reason %s",
    async (outcome, reason) => {
      const j = await makeJob(`u-reason-${outcome}`);
      setFakeScript([{ pose: "front", outcome, times: 2 }]);
      const r = await runInline(j.jobId);
      expect(r.status).toBe("complete_partial");
      const job = (await getJob(j.jobId))!;
      expect(job.poses.front!.status).toBe("failed");
      expect(job.poses.front!.reasons).toEqual([reason]);
      expect(job.poses.front!.attempts!["1"]!.qa).toEqual({
        verdict: "fail",
        reasons: [reason],
      });
    },
  );

  it("spend ceiling mid-set: failed(capacity), nothing published, never over cap", async () => {
    process.env.DAILY_CAP_USD = "0.10"; // fits two renders (~$0.04 each), not three
    const j = await makeJob("u-cap");
    const r = await runInline(j.jobId);
    expect(r.status).toBe("failed");
    expect(r.failureCode).toBe("capacity");
    const job = (await getJob(j.jobId))!;
    expect(job.failure?.code).toBe("capacity");
    expect(await rendersOf(j)).toEqual([]);
    expect(await listObjects(`staging/${j.jobId}/`)).toEqual([]);
    expect(getFakeCalls().length).toBeLessThanOrEqual(2);
    const day = await dayDoc();
    expect(day.committedMicros + day.pendingMicros).toBeLessThanOrEqual(
      usdToMicros(0.1),
    );
    expect(day.pendingMicros).toBe(0);
    expect((await getPoseSet(j.poseSetId))!.status).toBe("failed");
  });

  it("refuses under NODE_ENV=production without touching Firestore", async () => {
    const j = await makeJob("u-prod");
    const before = await jobSnapshot(j.jobId);
    const prev = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = "production";
    try {
      await expect(runInline(j.jobId)).rejects.toThrow(/Cloud Workflows/);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = prev!;
    }
    expect(await jobSnapshot(j.jobId)).toEqual(before);
    expect((await firestore().collection("spend").get()).size).toBe(0);
    expect(getFakeCalls()).toEqual([]);
  });
});

describe("idempotency", () => {
  it("renderPose twice: one provider call, one spend line, same outcome", async () => {
    const j = await makeJob("u-idem-render");
    const a = await renderPose({ jobId: j.jobId, pose: "front", attempt: 1 });
    const b = await renderPose({ jobId: j.jobId, pose: "front", attempt: 1 });
    expect(a).toEqual({ outcome: "rendered" });
    expect(b).toEqual(a);
    expect(getFakeCalls()).toHaveLength(1);
    expect(await spendLines(j.jobId)).toHaveLength(1);
  });

  it("renderPose replays a non-rendered outcome without calling again", async () => {
    const j = await makeJob("u-idem-blocked");
    setFakeScript([{ outcome: "blocked", times: 1 }]);
    const a = await renderPose({ jobId: j.jobId, pose: "front", attempt: 1 });
    const b = await renderPose({ jobId: j.jobId, pose: "front", attempt: 1 });
    expect([a.outcome, b.outcome]).toEqual(["blocked", "blocked"]);
    expect(getFakeCalls()).toHaveLength(1);
    expect(await spendLines(j.jobId)).toHaveLength(1);
  });

  it("renderPose recovers a crash after the model answered without calling again", async () => {
    const j = await makeJob("u-idem-crash");
    await renderPose({ jobId: j.jobId, pose: "front", attempt: 1 });
    // Simulate the crash: the outcome record is lost, reservation and staged object remain.
    await firestore()
      .collection("jobs")
      .doc(j.jobId)
      .update({ "poses.front.attempts.1.outcome": null });
    const again = await renderPose({
      jobId: j.jobId,
      pose: "front",
      attempt: 1,
    });
    expect(again.outcome).toBe("rendered");
    expect(getFakeCalls()).toHaveLength(1);
    expect(await spendLines(j.jobId)).toHaveLength(1);
  });

  it("every node called twice leaves the job document as calling it once", async () => {
    const j = await makeJob("u-idem-nodes", "blouse", [
      "front",
      "walking",
      "seated",
    ]);
    const { jobId } = j;
    const twice = async (fn: () => Promise<unknown>) => {
      await fn();
      const once = await jobSnapshot(jobId);
      await fn();
      expect(await jobSnapshot(jobId)).toEqual(once);
    };
    setFakeScript([{ pose: "seated", outcome: "blank", times: 2 }]);
    await twice(() => prepare({ jobId }));
    for (const pose of ["front", "walking"]) {
      await twice(() => renderPose({ jobId, pose, attempt: 1 }));
      await twice(() => qaPose({ jobId, pose, attempt: 1 }));
      await twice(() => publishPose({ jobId, pose, attempt: 1 }));
    }
    await twice(() => renderPose({ jobId, pose: "seated", attempt: 1 }));
    await twice(() => qaPose({ jobId, pose: "seated", attempt: 1 }));
    await twice(() => renderPose({ jobId, pose: "seated", attempt: 2 }));
    await twice(() => qaPose({ jobId, pose: "seated", attempt: 2 }));
    await twice(() => failPose({ jobId, pose: "seated" }));
    await twice(() => finalizeSet({ jobId }));
    expect((await getJob(jobId))!.status).toBe("complete_partial");
    expect(await rendersOf(j)).toHaveLength(2);
    // failJob on a finished job is a no-op, twice over.
    await twice(() => failJob({ jobId, code: "internal" }));
    expect((await getJob(jobId))!.status).toBe("complete_partial");
    expect(await rendersOf(j)).toHaveLength(2);
  });

  it("failJob twice on a running job: one failure, the first code wins", async () => {
    const j = await makeJob("u-idem-failjob");
    await runPoseToPublish(j.jobId, "front");
    await failJob({ jobId: j.jobId, code: "capacity", detail: "x" });
    const once = await jobSnapshot(j.jobId);
    await failJob({ jobId: j.jobId, code: "internal" });
    expect(await jobSnapshot(j.jobId)).toEqual(once);
    expect((await getJob(j.jobId))!.failure?.code).toBe("capacity");
    expect(await rendersOf(j)).toEqual([]);
  });
});

async function runPoseToPublish(jobId: string, pose: string) {
  await prepare({ jobId });
  await renderPose({ jobId, pose, attempt: 1 });
  await qaPose({ jobId, pose, attempt: 1 });
  await publishPose({ jobId, pose, attempt: 1 });
}

const fastSleep = () => new Promise<void>((r) => setTimeout(r, 40));

describe("overlap, joining and recovery", () => {
  it("two concurrent renderPose calls for one triple: one provider call, one spend line, same outcome", async () => {
    const j = await makeJob("u-overlap");
    setFakeScript([{ outcome: "ok", delayMs: 400 }]);
    const input = { jobId: j.jobId, pose: "front", attempt: 1 };
    const [a, b] = await Promise.all([
      renderPose(input, { sleep: fastSleep }),
      renderPose(input, { sleep: fastSleep }),
    ]);
    expect(a).toEqual({ outcome: "rendered" });
    expect(b).toEqual(a);
    expect(getFakeCalls()).toHaveLength(1);
    expect(await spendLines(j.jobId)).toHaveLength(1);
  });

  it("a retry arriving mid-call joins the original instead of calling again", async () => {
    const j = await makeJob("u-join");
    setFakeScript([{ outcome: "blocked", delayMs: 500 }]);
    const input = { jobId: j.jobId, pose: "front", attempt: 1 };
    const first = renderPose(input, { sleep: fastSleep });
    // Wait until the original holds its reservation, then retry.
    const ledger = new FirestoreDailyLedger(5);
    for (let i = 0; i < 100; i++) {
      if (await ledger.findReservation(j.jobId, "front", 1)) break;
      await fastSleep();
    }
    const retry = await renderPose(input, { sleep: fastSleep });
    expect(retry).toEqual({ outcome: "blocked" });
    expect(await first).toEqual({ outcome: "blocked" });
    expect(getFakeCalls()).toHaveLength(1);
    const lines = await spendLines(j.jobId);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.state).toBe("settled");
  });

  it("a reservation older than IN_FLIGHT_MS with no outcome is a crash: model_error, settled once, no call", async () => {
    const j = await makeJob("u-stale");
    const est = estimateCostMicros("nano-banana-2.1", 2);
    const old = new FirestoreDailyLedger(
      5,
      () => new Date(Date.now() - IN_FLIGHT_MS - 60_000),
    );
    await old.reserve(est, {
      jobId: j.jobId,
      pose: "front",
      attempt: 1,
    });
    const r = await renderPose(
      { jobId: j.jobId, pose: "front", attempt: 1 },
      { sleep: fastSleep },
    );
    expect(r).toEqual({ outcome: "model_error" });
    expect(getFakeCalls()).toHaveLength(0);
    const lines = await spendLines(j.jobId);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ state: "settled", actualMicros: est });
    // And again: still one line, one settlement.
    await renderPose(
      { jobId: j.jobId, pose: "front", attempt: 1 },
      { sleep: fastSleep },
    );
    expect((await dayDoc()).committedMicros).toBe(est);
  });

  it("a young reservation with no outcome waits, then throws a retryable error when the wait runs out", async () => {
    const j = await makeJob("u-wait");
    await new FirestoreDailyLedger(5).reserve(1000, {
      jobId: j.jobId,
      pose: "front",
      attempt: 1,
    });
    let clock = Date.now();
    await expect(
      renderPose(
        { jobId: j.jobId, pose: "front", attempt: 1 },
        {
          now: () => new Date(clock),
          sleep: async (ms) => {
            clock += ms * 50;
          },
        },
      ),
    ).rejects.toThrow(/still in flight/);
    expect(getFakeCalls()).toHaveLength(0);
  });

  it("renderPose on a failed job reserves nothing and calls nothing", async () => {
    const j = await makeJob("u-terminal");
    await updateJob(j.jobId, { status: "failed" });
    await expect(
      renderPose({ jobId: j.jobId, pose: "front", attempt: 1 }),
    ).rejects.toBeInstanceOf(JobTerminalError);
    expect(await spendLines(j.jobId)).toHaveLength(0);
    expect(getFakeCalls()).toHaveLength(0);
  });

  it("a job deleted during the model call leaves no staged object and records nothing", async () => {
    const j = await makeJob("u-gone");
    setFakeScript([{ outcome: "ok", delayMs: 300 }]);
    const p = renderPose({ jobId: j.jobId, pose: "front", attempt: 1 });
    const ledger = new FirestoreDailyLedger(5);
    for (let i = 0; i < 100; i++) {
      if (await ledger.findReservation(j.jobId, "front", 1)) break;
      await fastSleep();
    }
    await firestore().collection("jobs").doc(j.jobId).delete();
    await expect(p).rejects.toBeInstanceOf(JobTerminalError);
    expect(await listObjects(`staging/${j.jobId}/`)).toEqual([]);
    const lines = await spendLines(j.jobId);
    expect(lines[0]!.state).toBe("settled");
  });
});

describe("internal failure text stays server-side", () => {
  it("a failed job keeps detail out of the job doc and in jobInternals", async () => {
    const j = await makeJob("u-internals");
    setFakeScript([{ outcome: "blocked", times: 1 }]);
    await renderPose({ jobId: j.jobId, pose: "front", attempt: 1 });
    await failJob({
      jobId: j.jobId,
      code: "internal",
      detail: "svc-account@secret.iam and a stack",
    });
    const raw = JSON.stringify(
      (await firestore().collection("jobs").doc(j.jobId).get()).data(),
    );
    expect(raw).not.toContain('"detail"');
    expect(raw).not.toContain("svc-account");
    expect(raw).not.toContain("SAFETY");
    const internals = (await getJobInternal(j.jobId))!;
    expect(internals.failureDetail).toContain("svc-account");
    expect(internals.attempts!["front_1"]).toContain("blocked by policy");
    expect((await getJob(j.jobId))!.poses.front!.attempts!["1"]!.outcome).toBe(
      "blocked",
    );
  });
});

describe("capacity and late publish", () => {
  it("a capacity outcome marks the pose failed(capacity), not rendering", async () => {
    process.env.DAILY_CAP_USD = "0.001";
    const j = await makeJob("u-capacity-pose");
    const r = await renderPose({ jobId: j.jobId, pose: "front", attempt: 1 });
    expect(r).toEqual({ outcome: "capacity" });
    const pose = (await getJob(j.jobId))!.poses.front!;
    expect(pose).toMatchObject({ status: "failed", reasons: ["capacity"] });
    expect(getFakeCalls()).toHaveLength(0);
  });

  it("a set that fails between the check and the write leaves no render behind", async () => {
    const j = await makeJob("u-late");
    await renderPose({ jobId: j.jobId, pose: "front", attempt: 1 });
    await qaPose({ jobId: j.jobId, pose: "front", attempt: 1 });
    await expect(
      publishPose(
        { jobId: j.jobId, pose: "front", attempt: 1 },
        {
          beforeWrite: () =>
            failJob({ jobId: j.jobId, code: "internal" }).then(() => undefined),
        },
      ),
    ).rejects.toBeInstanceOf(JobTerminalError);
    expect(await rendersOf(j)).toEqual([]);
    const job = (await getJob(j.jobId))!;
    expect(job.poses.front!.status).not.toBe("passed");
    expect((await getPoseSet(j.poseSetId))!.poses).toEqual([]);
  });

  it("a set deleted between the check and the write leaves no render behind", async () => {
    const j = await makeJob("u-late2");
    await renderPose({ jobId: j.jobId, pose: "front", attempt: 1 });
    await qaPose({ jobId: j.jobId, pose: "front", attempt: 1 });
    await expect(
      publishPose(
        { jobId: j.jobId, pose: "front", attempt: 1 },
        {
          beforeWrite: async () => {
            await firestore().collection("jobs").doc(j.jobId).delete();
          },
        },
      ),
    ).rejects.toBeInstanceOf(JobTerminalError);
    expect(await rendersOf(j)).toEqual([]);
  });
});

describe("publishPose guard", () => {
  it("throws when the attempt's verdict is fail, writing nothing", async () => {
    const j = await makeJob("u-pub-fail");
    setFakeScript([{ pose: "front", outcome: "blank", times: 1 }]);
    await prepare({ jobId: j.jobId });
    await renderPose({ jobId: j.jobId, pose: "front", attempt: 1 });
    const qa = await qaPose({ jobId: j.jobId, pose: "front", attempt: 1 });
    expect(qa.verdict).toBe("fail");
    await expect(
      publishPose({ jobId: j.jobId, pose: "front", attempt: 1 }),
    ).rejects.toThrow(/refusing to publish/);
    expect(await listObjects("renders/")).toEqual([]);
  });

  it("throws with no QA record, writing nothing", async () => {
    const j = await makeJob("u-pub-noqa");
    await prepare({ jobId: j.jobId });
    await renderPose({ jobId: j.jobId, pose: "front", attempt: 1 });
    await expect(
      publishPose({ jobId: j.jobId, pose: "front", attempt: 1 }),
    ).rejects.toThrow(/refusing to publish/);
    await expect(
      publishPose({ jobId: j.jobId, pose: "walking", attempt: 1 }),
    ).rejects.toThrow(/refusing to publish/);
    expect(await listObjects("renders/")).toEqual([]);
  });

  it("refuses a failed attempt even when a later attempt would pass elsewhere", async () => {
    const j = await makeJob("u-pub-attempt");
    setFakeScript([{ pose: "front", outcome: "blank", times: 1 }]);
    await prepare({ jobId: j.jobId });
    await renderPose({ jobId: j.jobId, pose: "front", attempt: 1 });
    await qaPose({ jobId: j.jobId, pose: "front", attempt: 1 });
    await renderPose({ jobId: j.jobId, pose: "front", attempt: 2 });
    await qaPose({ jobId: j.jobId, pose: "front", attempt: 2 });
    await expect(
      publishPose({ jobId: j.jobId, pose: "front", attempt: 1 }),
    ).rejects.toThrow();
    expect(await listObjects("renders/")).toEqual([]);
    await publishPose({ jobId: j.jobId, pose: "front", attempt: 2 });
    expect(await listObjects("renders/")).toHaveLength(1);
  });
});

// mulberry32: a tiny seeded PRNG so the randomised scripts are reproducible.
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("invariant", () => {
  let raw: Record<string, Buffer>;
  beforeAll(async () => {
    // What the fake produces for each pose, so published pixels can be compared with the raw.
    process.env.RENDER_PROVIDER = "fake";
    setFakeScript([]);
    const item = getItem("blouse")!;
    raw = {};
    for (const pose of POSE_LIST) {
      const res = await fakeProvider({
        model: "nano-banana-2.1",
        prompt: buildPrompt({
          pose: pose as Pose,
          category: item.category!,
          wearing: GENERIC_WEARING,
          target: item.promptDescription,
        }),
        images: [await loadItemImage(item.id), await loadItemImage(item.id)],
        aspectRatio: "3:4",
        meta: { pose },
      });
      raw[pose] = res.image!.data;
    }
  });

  it(
    "across 20 seeded random scripts, renders/ holds only passed poses, untouched",
    { timeout: 240_000 },
    async () => {
      const failing: FakeOutcome[] = [
        "error",
        "blank",
        "undersized",
        "blocked",
        "no_image",
        "copy_input",
      ];
      for (let seed = 1; seed <= 20; seed++) {
        const rand = rng(seed);
        const script: FakeRule[] = [];
        for (const pose of POSE_LIST) {
          const fails = Math.floor(rand() * 3); // 0, 1 or 2 failures before ok
          if (fails > 0) {
            script.push({
              pose,
              outcome: failing[Math.floor(rand() * failing.length)]!,
              times: fails,
            });
          }
        }
        setFakeScript(script);
        const j = await makeJob(`u-inv-${seed}`);
        const r = await runInline(j.jobId);
        const job = (await getJob(j.jobId))!;
        expect(["complete", "complete_partial", "failed"]).toContain(r.status);
        const objects = await rendersOf(j);
        if (job.status === "failed") expect(objects).toEqual([]);
        else expect(["complete", "complete_partial"]).toContain(job.status);
        for (const name of objects) {
          const pose = name
            .split("/")
            .pop()!
            .replace(/\.jpg$/, "");
          expect(job.poses[pose]!.status).toBe("passed");
          expect(name.startsWith(`renders/${j.uid}/${j.poseSetId}/`)).toBe(
            true,
          );
          const [buf] = await bucket().file(name).download();
          const a = await sharp(buf)
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
          const b = await sharp(raw[pose]!)
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
          expect([a.info.width, a.info.height]).toEqual([
            b.info.width,
            b.info.height,
          ]);
          // Nothing drawn on it: within JPEG transcode tolerance of the staged render.
          // Per 16x16 block, so a small overlay cannot hide behind a near-unchanged global mean.
          expect(
            maxBlockMeanDiff(
              a.data,
              b.data,
              a.info.width,
              a.info.height,
              a.info.channels,
            ),
          ).toBeLessThan(12);
        }
        // Passed poses in a complete/partial job each have an object, and nothing else does.
        if (job.status !== "failed") {
          const passed = POSE_LIST.filter(
            (p) => job.poses[p]!.status === "passed",
          );
          expect(objects).toHaveLength(passed.length);
        }
        expect(await listObjects(`staging/${j.jobId}/`)).toEqual([]);
      }
    },
  );
});

it("fixture sanity: photo is stored", async () => {
  const j = await makeJob("u-sanity");
  expect(
    await getPhotoBytes(j.uid, (await getJob(j.jobId))!.photoId),
  ).not.toBeNull();
});

// The Cloud Workflow has no emulator. This drives the real node endpoints (route handlers, signed
// requests) in the order workflows/render-pose-set.yaml prescribes and checks the result equals
// what the inline orchestrator produces from the same fake script.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { firestore, getJob, getPoseSet, type SpendLogDoc } from "@trailroom/db";
import { runInline } from "@trailroom/pipeline";
import { getFakeCalls, setFakeScript, type FakeRule } from "@trailroom/render";
import { clearFirestore } from "../../../../packages/db/src/emu-helpers";
import {
  clearBucket,
  jobSnapshot,
  listObjects,
  makeJob,
} from "../../../../packages/pipeline/src/testkit";
import { useKeySourceForTests } from "./oidc";
import {
  AUDIENCE,
  keySourceFor,
  makeKey,
  SCHEDULER_SA,
  WORKFLOWS_SA,
} from "./oidc-testkit";
import { makeDriver } from "./workflow-driver";

const key = makeKey();
const UID = "u-parity";

beforeEach(async () => {
  process.env.RENDER_PROVIDER = "fake";
  process.env.INTERNAL_AUDIENCE = AUDIENCE;
  process.env.WORKFLOWS_SA_EMAIL = WORKFLOWS_SA;
  process.env.SCHEDULER_SA_EMAIL = SCHEDULER_SA;
  delete process.env.DAILY_CAP_USD;
  useKeySourceForTests(keySourceFor(key));
  setFakeScript(null);
  await clearFirestore();
  await clearBucket();
});
afterEach(() => {
  setFakeScript(null);
  useKeySourceForTests(null);
  delete process.env.DAILY_CAP_USD;
});

interface Outcome {
  returned: string;
  poseStates: any;
  job: any;
  poseSet: any;
  renders: string[];
  staging: string[];
  calls: number;
  spendLines: number;
}

async function observe(
  jobId: string,
  poseSetId: string,
  returned: string,
  full: boolean,
): Promise<Outcome> {
  const snap = (await jobSnapshot(jobId)) as any;
  const poseStates = snap.poses;
  for (const k of ["createdAt", "expiresAt"]) delete snap[k];
  const ps: any = await getPoseSet(poseSetId);
  const lines = await firestore().collection("spendLog").get();
  return {
    returned,
    poseStates,
    job: full ? snap : { status: snap.status, failure: snap.failure },
    poseSet: full
      ? { status: ps.status, poses: [...ps.poses].sort() }
      : { status: ps.status },
    renders: (await listObjects(`renders/${UID}/`)).map((n) =>
      n.split("/").pop()!,
    ),
    staging: await listObjects("staging/"),
    calls: getFakeCalls().length,
    spendLines: lines.docs.filter((d) => (d.data() as SpendLogDoc).state)
      .length,
  };
}

async function viaInline(rules: FakeRule[], full: boolean) {
  const j = await makeJob(UID);
  setFakeScript(rules);
  const r = await runInline(j.jobId);
  return observe(j.jobId, j.poseSetId, r.status, full);
}

async function viaWorkflow(rules: FakeRule[], full: boolean, twice = false) {
  const j = await makeJob(UID);
  setFakeScript(rules);
  const status = await makeDriver(key, { twice })(j.jobId);
  return observe(j.jobId, j.poseSetId, status, full);
}

async function reset() {
  await clearFirestore();
  await clearBucket();
  setFakeScript(null);
}

const SCENARIOS: [string, FakeRule[], string][] = [
  ["happy path", [], "complete"],
  [
    "one pose failing once then passing",
    [{ pose: "walking", outcome: "error", times: 1 }],
    "complete",
  ],
  [
    "one pose failing twice (partial)",
    [{ pose: "walking", outcome: "blank", times: 5 }],
    "complete_partial",
  ],
  [
    "two poses failing twice (failed set)",
    [
      { pose: "walking", outcome: "blank", times: 5 },
      { pose: "seated", outcome: "undersized", times: 5 },
    ],
    "failed",
  ],
];

describe("workflow order over the node endpoints == runInline", () => {
  it.each(SCENARIOS)("%s", async (_name, rules, status) => {
    const inline = await viaInline(rules, true);
    await reset();
    const wf = await viaWorkflow(rules, true);
    expect(wf).toEqual(inline);
    expect(wf.returned).toBe(status);
    if (status !== "failed")
      expect(wf.renders.length).toBeGreaterThanOrEqual(3);
    else expect(wf.renders).toEqual([]);
  });

  it("capacity mid-set: both end failed(capacity) with nothing published", async () => {
    process.env.DAILY_CAP_USD = "0.10"; // fits two renders, not three
    const inline = await viaInline([], false);
    await reset();
    const wf = await viaWorkflow([], false);
    expect(wf.returned).toBe("failed");
    expect(wf.job).toEqual({ status: "failed", failure: { code: "capacity" } });
    expect(wf.job).toEqual(inline.job);
    expect(wf.renders).toEqual([]);
    expect(wf.staging).toEqual([]);
    expect(wf.renders).toEqual(inline.renders);
    expect(wf.calls).toBeLessThanOrEqual(2);
    expect(wf.poseSet).toEqual(inline.poseSet);
    // Pose states too: no pose is left rendering or pending, and each pose the ceiling stopped
    // is failed with reason "capacity", the same in both drivers.
    for (const o of [inline, wf]) {
      const states = Object.values(o.poseStates) as {
        status: string;
        reasons: string[];
      }[];
      expect(states.map((p) => p.status)).not.toContain("rendering");
      expect(states.map((p) => p.status)).not.toContain("pending");
      const capped = states.filter((p) => p.reasons.includes("capacity"));
      expect(capped.every((p) => p.status === "failed")).toBe(true);
      expect(capped.length).toBe(states.length - o.calls);
    }
  });
});

describe("replay: every endpoint called twice", () => {
  it.each([
    ["happy path", [] as FakeRule[]],
    [
      "a pose failing twice",
      [{ pose: "walking", outcome: "blank", times: 5 }] as FakeRule[],
    ],
    [
      "a pose failing once",
      [{ pose: "seated", outcome: "error", times: 1 }] as FakeRule[],
    ],
  ])(
    "%s: same responses, same job, same provider calls and spend",
    async (_n, rules) => {
      const once = await viaWorkflow(rules, true, false);
      await reset();
      const seen = new Set<string>();
      const j = await makeJob(UID);
      setFakeScript(rules);
      const twice = await makeDriver(key, {
        twice: true,
        onCall: (seg) => seen.add(seg),
      })(j.jobId);
      const got = await observe(j.jobId, j.poseSetId, twice, true);
      expect(got).toEqual(once);
      expect(got.calls).toBe(once.calls);
      expect(got.spendLines).toBe(once.spendLines);
      for (const seg of [
        "prepare",
        "render-pose",
        "qa-pose",
        "publish-pose",
        "finalize-set",
      ]) {
        expect(seen.has(seg), seg).toBe(true);
      }
    },
  );

  it("fail-job and fail-pose replay too", async () => {
    const j = await makeJob(UID);
    const driver = makeDriver(key, { twice: true });
    setFakeScript([{ pose: "walking", outcome: "blank", times: 5 }]);
    expect(await driver(j.jobId)).toBe("complete_partial");
    const j2 = await makeJob("u-parity-2");
    process.env.DAILY_CAP_USD = "0.01";
    expect(await makeDriver(key, { twice: true })(j2.jobId)).toBe("failed");
    const job = (await getJob(j2.jobId))!;
    expect(job.failure?.code).toBe("capacity");
  });
});

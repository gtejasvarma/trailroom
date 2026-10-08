import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getUsage, firestore, getJob, getPoseSet } from "@trailroom/db";
import { Timestamp } from "firebase-admin/firestore";
import { DELETE as photoDELETE } from "../app/api/photo/route";
import { startTryOn } from "./tryon";
import {
  GUEST_DAILY_STARTS,
  SIGNED_IN_DAILY_STARTS,
  STALE_JOB_MS,
} from "./limits";
import { getFakeCalls, setFakeScript } from "@trailroom/render";
import { listObjects } from "../../../../packages/pipeline/src/testkit";
import { POST as tryOnPOST } from "../app/api/try-on/route";
import { GET as jobGET } from "../app/api/jobs/[jobId]/route";
import { GET as renderGET } from "../app/api/renders/[poseSetId]/[pose]/route";
import { startRender, awaitInlineRuns } from "./orchestrator";
import { startWorkflowExecution } from "./workflows";
import {
  anonymousToken,
  consent,
  emailToken,
  req,
  reset,
  uidOf,
  uploadOk,
  waitForJob,
} from "./testkit";

// Never reach the real Workflows API from a test.
vi.mock("./workflows", () => ({ startWorkflowExecution: vi.fn() }));

process.env.RENDER_PROVIDER = "fake";
process.env.ORCHESTRATOR = "inline";

beforeEach(async () => {
  process.env.ORCHESTRATOR = "inline";
  setFakeScript(null);
  await reset();
});
afterEach(async () => {
  await awaitInlineRuns();
  setFakeScript(null);
  vi.unstubAllEnvs();
});

const params = <T>(p: T) => ({ params: Promise.resolve(p) });
const tryOn = (token: string | undefined, itemId: string) =>
  tryOnPOST(req("POST", "/api/try-on", { token, json: { itemId } }));
const spendLines = async () =>
  (await firestore().collection("spendLog").get()).size;
const jobCount = async (uid: string) =>
  (await firestore().collection("jobs").where("uid", "==", uid).get()).size;
const jobFor = (t: string, id: string) =>
  jobGET(req("GET", `/api/jobs/${id}`, { token: t }), params({ jobId: id }));
const render = (t: string, setId: string, pose: string) =>
  renderGET(
    req("GET", `/api/renders/${setId}/${pose}`, { token: t }),
    params({ poseSetId: setId, pose }),
  );

async function ready(kind: "guest" | "user" = "guest") {
  const t = kind === "guest" ? await anonymousToken() : await emailToken();
  await consent(t);
  await uploadOk(t);
  return t;
}
async function finish(t: string, itemId: string) {
  const res = await tryOn(t, itemId);
  const body = await res.json();
  expect(res.status).toBe(202);
  await waitForJob(body.jobId, getJob);
  return body as { jobId: string; poseSetId: string };
}

describe("try-on refusals", () => {
  it("no consent is 403, no photo is 409, unknown item is 404", async () => {
    const t = await anonymousToken();
    let res = await tryOn(t, "g-parka");
    expect([res.status, (await res.json()).error]).toEqual([
      403,
      "consent_required",
    ]);
    await consent(t);
    res = await tryOn(t, "g-parka");
    expect([res.status, (await res.json()).error]).toEqual([
      409,
      "photo_required",
    ]);
    await uploadOk(t);
    res = await tryOn(t, "nope");
    expect([res.status, (await res.json()).error]).toEqual([
      404,
      "unknown_item",
    ]);
    res = await tryOnPOST(req("POST", "/api/try-on", { token: t, json: {} }));
    expect(res.status).toBe(400);
    expect(getFakeCalls()).toHaveLength(0);
    expect(await spendLines()).toBe(0);
  });

  it("an unready item is 409 not_ready with three closest, no job, no calls, no spend", async () => {
    const t = await ready();
    const res = await tryOn(t, "g-leather-coat");
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toBe("not_ready");
    expect(body.closest).toHaveLength(3);
    expect(body.closest).not.toContain("g-leather-coat");
    expect(body.reasons.length).toBeGreaterThan(0);
    expect(getFakeCalls()).toHaveLength(0);
    expect(await spendLines()).toBe(0);
    expect(await jobCount(uidOf(t))).toBe(0);
  });
});

describe("try-on happy path, reuse and caps", () => {
  it("renders four poses; the same item again is reused with no extra calls or spend", async () => {
    const t = await ready();
    const first = await finish(t, "g-parka");
    const job = (await getJob(first.jobId))!;
    expect(job.status).toBe("complete");
    const objs = await listObjects(`renders/${uidOf(t)}/${first.poseSetId}/`);
    expect(objs).toHaveLength(4);
    const calls = getFakeCalls().length;
    const spend = await spendLines();
    expect(calls).toBeGreaterThanOrEqual(4);

    const res = await tryOn(t, "g-parka");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...first, reused: true });
    expect(getFakeCalls()).toHaveLength(calls);
    expect(await spendLines()).toBe(spend);
    expect(await jobCount(uidOf(t))).toBe(1);
  });

  it("a guest's second item is signup_required with no spend; a signed-in user can start another", async () => {
    const g = await ready("guest");
    await finish(g, "g-parka");
    const spend = await spendLines();
    const calls = getFakeCalls().length;
    const res = await tryOn(g, "g-shell-jacket");
    expect([res.status, (await res.json()).error]).toEqual([
      403,
      "signup_required",
    ]);
    expect(await spendLines()).toBe(spend);
    expect(getFakeCalls()).toHaveLength(calls);

    const u = await ready("user");
    await finish(u, "g-parka");
    const second = await tryOn(u, "g-shell-jacket");
    expect(second.status).toBe(202);
  });

  it("a failed set is cleared and the same item can be started again", async () => {
    const t = await ready();
    setFakeScript([{ outcome: "error" }]);
    const first = await finish(t, "g-parka");
    expect((await getJob(first.jobId))!.status).toBe("failed");
    expect((await getPoseSet(first.poseSetId))!.status).toBe("failed");

    setFakeScript(null);
    const res = await tryOn(t, "g-parka");
    const second = await res.json();
    expect([res.status, second.reused]).toEqual([202, false]);
    expect(second.jobId).not.toBe(first.jobId);
    expect(await getJob(first.jobId)).toBeNull();
    await waitForJob(second.jobId, getJob);
    expect((await getPoseSet(second.poseSetId))!.status).toBe("complete");
  });

  it("two concurrent requests for the same key create one job", async () => {
    const t = await ready("user");
    const [a, b] = await Promise.all([
      tryOn(t, "g-parka"),
      tryOn(t, "g-parka"),
    ]);
    const [ja, jb] = [await a.json(), await b.json()];
    expect(ja.jobId).toBe(jb.jobId);
    expect([a.status, b.status].sort()).toEqual([200, 202]);
    expect(await jobCount(uidOf(t))).toBe(1);
    await waitForJob(ja.jobId, getJob);
    expect(getFakeCalls().length).toBe(4);
  });

  it("if the orchestrator cannot start, the job is failed and the response is 503", async () => {
    const t = await ready();
    vi.stubEnv("ORCHESTRATOR", "workflows");
    vi.mocked(startWorkflowExecution).mockRejectedValueOnce(
      new Error("GOOGLE_CLOUD_PROJECT is not set; cannot start a workflow"),
    );
    const res = await tryOn(t, "g-parka");
    expect([res.status, (await res.json()).error]).toEqual([
      503,
      "start_failed",
    ]);
    const jobs = await firestore().collection("jobs").get();
    expect(jobs.docs[0]!.data().status).toBe("failed");
    expect(jobs.docs[0]!.data().failure.code).toBe("internal");
    expect(getFakeCalls()).toHaveLength(0);
  });
});

describe("daily limits and the guest race", () => {
  it("a guest's third start in a day is 429 with zero new spend", async () => {
    const g = await ready("guest");
    setFakeScript([{ outcome: "error" }]);
    for (let i = 0; i < GUEST_DAILY_STARTS; i++) {
      await finish(g, "g-parka"); // failed sets count
    }
    const spend = await spendLines();
    const calls = getFakeCalls().length;
    const res = await tryOn(g, "g-parka");
    expect([res.status, (await res.json()).error]).toEqual([
      429,
      "daily_limit",
    ]);
    expect(await spendLines()).toBe(spend);
    expect(getFakeCalls()).toHaveLength(calls);
  });

  it("a signed-in user's sixth start is 429", async () => {
    const u = await ready("user");
    setFakeScript([{ outcome: "error" }]);
    for (let i = 0; i < SIGNED_IN_DAILY_STARTS; i++) await finish(u, "g-parka");
    const res = await tryOn(u, "g-parka");
    expect([res.status, (await res.json()).error]).toEqual([
      429,
      "daily_limit",
    ]);
    expect((await getUsage(uidOf(u)))!.starts).toBe(SIGNED_IN_DAILY_STARTS);
  });

  it("Delete my photo then re-consent and re-upload does not reset the count", async () => {
    const g = await ready("guest");
    setFakeScript([{ outcome: "error" }]);
    for (let i = 0; i < GUEST_DAILY_STARTS; i++) await finish(g, "g-parka");
    await photoDELETE(req("DELETE", "/api/photo", { token: g }));
    await consent(g);
    await uploadOk(g);
    const res = await tryOn(g, "g-parka");
    expect([res.status, (await res.json()).error]).toEqual([
      429,
      "daily_limit",
    ]);
  });

  it("reusing a pose set and refusals do not consume a start", async () => {
    const u = await ready("user");
    await finish(u, "g-parka");
    for (let i = 0; i < 4; i++)
      expect((await tryOn(u, "g-parka")).status).toBe(200);
    await tryOn(u, "g-leather-coat"); // not ready
    await tryOn(u, "nope");
    expect((await getUsage(uidOf(u)))!.starts).toBe(1);
  });

  it("the count rolls over at UTC midnight (injectable clock)", async () => {
    const g = await ready("guest");
    const user = { uid: uidOf(g), isGuest: true };
    setFakeScript([{ outcome: "error" }]);
    const day1 = new Date("2030-03-01T23:30:00Z");
    for (let i = 0; i < GUEST_DAILY_STARTS; i++) {
      const r = await startTryOn(user, { itemId: "g-parka" }, day1);
      expect(r.status).toBe(202);
      await waitForJob((r.body as { jobId: string }).jobId, getJob);
    }
    expect((await startTryOn(user, { itemId: "g-parka" }, day1)).status).toBe(
      429,
    );
    const next = await startTryOn(
      user,
      { itemId: "g-parka" },
      new Date("2030-03-02T00:05:00Z"),
    );
    expect(next.status).toBe(202);
  });

  it("two concurrent guest starts for different items: one job, the other signup_required", async () => {
    const g = await ready("guest");
    const [a, b] = await Promise.all([
      tryOn(g, "g-parka"),
      tryOn(g, "g-shell-jacket"),
    ]);
    const bodies = [await a.json(), await b.json()];
    expect([a.status, b.status].sort()).toEqual([202, 403]);
    expect(bodies.map((x) => x.error).filter(Boolean)).toEqual([
      "signup_required",
    ]);
    expect(await jobCount(uidOf(g))).toBe(1);
    await waitForJob(bodies.find((x) => x.jobId).jobId, getJob);
    expect(getFakeCalls().length).toBe(4);
  });
});

describe("hung jobs", () => {
  async function hungJob(t: string, ageMs: number) {
    vi.stubEnv("ORCHESTRATOR", "workflows");
    const res = await tryOn(t, "g-parka");
    const { jobId } = await res.json();
    vi.stubEnv("ORCHESTRATOR", "inline");
    await firestore()
      .collection("jobs")
      .doc(jobId)
      .update({
        status: "rendering",
        updatedAt: Timestamp.fromMillis(Date.now() - ageMs),
      });
    return jobId as string;
  }

  it("a rendering set whose job stopped moving is failed and restarted, not reused", async () => {
    const u = await ready("user");
    const old = await hungJob(u, STALE_JOB_MS + 60_000);
    const res = await tryOn(u, "g-parka");
    const body = await res.json();
    expect([res.status, body.reused]).toEqual([202, false]);
    expect(body.jobId).not.toBe(old);
    expect(await getJob(old)).toBeNull();
    await waitForJob(body.jobId, getJob);
  });

  it("a recently active rendering set is still reused", async () => {
    const u = await ready("user");
    const live = await hungJob(u, 60_000);
    const res = await tryOn(u, "g-parka");
    expect([res.status, (await res.json()).jobId]).toEqual([200, live]);
  });
});

describe("jobs and renders", () => {
  it("owner gets JSON with ISO timestamps; another user gets 404", async () => {
    const a = await ready();
    const b = await ready();
    const { jobId, poseSetId } = await finish(a, "g-parka");
    const res = await jobFor(a, jobId);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toMatchObject({
      jobId,
      poseSetId,
      status: "complete",
      aiGenerated: true,
      failure: null,
    });
    expect(new Date(body.createdAt).toISOString()).toBe(body.createdAt);
    expect(new Date(body.updatedAt).toISOString()).toBe(body.updatedAt);
    expect(body.poseOrder).toHaveLength(4);
    expect(body.poses[body.poseOrder[0]]).toMatchObject({ status: "passed" });
    expect(body.closest).toBeUndefined();

    const other = await jobFor(b, jobId);
    expect(other.status).toBe(404);
    expect((await other.json()).error).toBe("not_found");
    expect((await jobFor(a, "does-not-exist")).status).toBe(404);
    expect((await jobFor(a, "..")).status).toBe(404);
  });

  it("a failed job lists the closest three", async () => {
    const t = await ready();
    setFakeScript([{ outcome: "error" }]);
    const { jobId } = await finish(t, "g-parka");
    const body = await (await jobFor(t, jobId)).json();
    expect(body.status).toBe("failed");
    expect(body.failure.code).toBeDefined();
    expect(body.closest).toHaveLength(3);
  });

  it("owner gets private no-store JPEG bytes; others and odd params get 404", async () => {
    const a = await ready();
    const b = await ready();
    const { poseSetId, jobId } = await finish(a, "g-parka");
    const pose = (await getPoseSet(poseSetId))!.poses[0]!;

    const res = await render(a, poseSetId, pose);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const bytes = Buffer.from(await res.arrayBuffer());
    expect((await sharp(bytes).metadata()).format).toBe("jpeg");

    expect((await render(b, poseSetId, pose)).status).toBe(404);
    expect((await render(a, poseSetId, "sideways")).status).toBe(404);
    const uid = uidOf(a);
    const odd: [string, string][] = [
      ["..", pose],
      [poseSetId, ".."],
      [poseSetId, "../../photos/" + uid + "/base"],
      [poseSetId, "..%2F..%2Fphotos%2Fbase"],
      [poseSetId, "base.jpg"],
      ["photos", uid],
      ["staging", jobId],
      [`${uid}/${poseSetId}`, pose],
      [poseSetId, "photos"],
      [poseSetId, "staging"],
      ["", pose],
    ];
    for (const [s, p] of odd) {
      const r = await render(a, s, p);
      expect(r.status, `${s} / ${p}`).toBe(404);
      expect(r.headers.get("content-type")).toContain("application/json");
    }
  });

  it("a failed pose inside a partial set is 404 while its siblings are served", async () => {
    const t = await ready();
    setFakeScript([{ pose: "seated", outcome: "error" }]);
    const { jobId, poseSetId } = await finish(t, "g-parka");
    expect((await getJob(jobId))!.status).toBe("complete_partial");
    expect((await render(t, poseSetId, "seated")).status).toBe(404);
    expect((await render(t, poseSetId, "front")).status).toBe(200);
  });

  it("DELETE /api/photo with a completed job removes renders, staging, job, pose set, consent and photo", async () => {
    const t = await ready();
    const uid = uidOf(t);
    const { jobId, poseSetId } = await finish(t, "g-parka");
    expect(await listObjects(`renders/${uid}/`)).not.toEqual([]);
    const del = await photoDELETE(req("DELETE", "/api/photo", { token: t }));
    expect(del.status).toBe(200);
    expect(await listObjects(`renders/${uid}/`)).toEqual([]);
    expect(await listObjects(`staging/${jobId}/`)).toEqual([]);
    expect(await listObjects(`photos/${uid}/`)).toEqual([]);
    const db = firestore();
    expect((await db.collection("jobs").doc(jobId).get()).exists).toBe(false);
    expect((await db.collection("jobInternals").doc(jobId).get()).exists).toBe(
      false,
    );
    expect((await db.collection("poseSets").doc(poseSetId).get()).exists).toBe(
      false,
    );
    expect((await db.collection("consents").doc(uid).get()).exists).toBe(false);
    expect((await db.collection("photos").doc(uid).get()).exists).toBe(false);
  });

  it("a failed set serves nothing", async () => {
    const t = await ready();
    setFakeScript([{ outcome: "error" }]);
    const { poseSetId } = await finish(t, "g-parka");
    expect((await render(t, poseSetId, "walking")).status).toBe(404);
  });
});

describe("startRender", () => {
  it("refuses ORCHESTRATOR=inline in production; unknown value throws", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ORCHESTRATOR", "inline");
    await expect(startRender("j")).rejects.toThrow(/production/);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("ORCHESTRATOR", "banana");
    await expect(startRender("j")).rejects.toThrow(/inline.*workflows/);
    vi.stubEnv("ORCHESTRATOR", "workflows");
    await startRender("j");
    expect(startWorkflowExecution).toHaveBeenCalledWith("j");
  });

  it("the default is workflows", async () => {
    vi.stubEnv("ORCHESTRATOR", undefined as unknown as string);
    delete process.env.ORCHESTRATOR;
    vi.mocked(startWorkflowExecution).mockClear();
    await startRender("k");
    expect(startWorkflowExecution).toHaveBeenCalledWith("k");
  });
});

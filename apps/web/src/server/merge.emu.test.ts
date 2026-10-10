// POST /api/account/merge: a guest's finished try-on moves into an account that already existed.
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth, getJob, getPoseSet, listPhotos } from "@trailroom/db";
import { POSES, setFakeScript } from "@trailroom/render";
import { POST as mergePOST } from "../app/api/account/merge/route";
import { GET as renderGET } from "../app/api/renders/[poseSetId]/[pose]/route";
import { GET as jobGET } from "../app/api/jobs/[jobId]/route";
import { POST as tryOnPOST } from "../app/api/try-on/route";
import { awaitInlineRuns } from "./orchestrator";
import { purgeExpiredGuests } from "./purge";
import {
  anonymousToken,
  emailToken,
  req,
  reset,
  uidOf,
  uploadOk,
  waitForJob,
} from "./testkit";

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
});

const POSE_LIST = Object.keys(POSES);
const params = <T>(p: T) => ({ params: Promise.resolve(p) });
const merge = (caller: string | undefined, json: unknown) =>
  mergePOST(
    req("POST", "/api/account/merge", { token: caller, json: json as object }),
  );
const job = (t: string, id: string) =>
  jobGET(req("GET", `/api/jobs/${id}`, { token: t }), params({ jobId: id }));
const full = (t: string, setId: string, pose: string) =>
  renderGET(
    req("GET", `/api/renders/${setId}/${pose}`, { token: t }),
    params({ poseSetId: setId, pose }),
  );

async function guestWithTryOn() {
  const g = await anonymousToken();
  await uploadOk(g);
  const res = await tryOnPOST(
    req("POST", "/api/try-on", { token: g, json: { itemId: "blouse" } }),
  );
  const body = (await res.json()) as { jobId: string; poseSetId: string };
  await waitForJob(body.jobId, getJob);
  return { g, ...body };
}

describe("POST /api/account/merge", () => {
  it("moves the try-on: the account opens every pose at full size by the same job id", async () => {
    const { g, jobId } = await guestWithTryOn();
    const guestUid = uidOf(g);
    const acct = await emailToken();
    const res = await merge(acct, { guestToken: g });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.photos).toBe(1);
    expect(body.tryOns).toHaveLength(1);
    expect(body.tryOns[0].jobId).toBe(jobId);

    const j = await job(acct, jobId);
    expect(j.status).toBe(200);
    expect((await job(await emailToken(), jobId)).status).toBe(404);
    const newSet = body.tryOns[0].poseSetId as string;
    expect((await getPoseSet(newSet))?.uid).toBe(uidOf(acct));
    for (const pose of POSE_LIST) {
      const r = await full(acct, newSet, pose);
      expect(r.status).toBe(200);
      const m = await sharp(Buffer.from(await r.arrayBuffer())).metadata();
      expect(Math.max(m.width!, m.height!)).toBeGreaterThan(320);
    }
    expect(await listPhotos(uidOf(acct))).toHaveLength(1);
    await expect(auth().getUser(guestUid)).rejects.toMatchObject({
      code: "auth/user-not-found",
    });

    // Again: the guest's Auth user is gone, so its token no longer verifies; nothing changes.
    expect((await merge(acct, { guestToken: g })).status).toBe(403);
    expect(await listPhotos(uidOf(acct))).toHaveLength(1);

    await purgeExpiredGuests(new Date("2099-01-01T00:00:00Z"));
    expect((await job(acct, jobId)).status).toBe(200);
  });

  it("refuses: no token, garbage, a non-anonymous token, the caller's own, an anonymous caller", async () => {
    const { g } = await guestWithTryOn();
    const acct = await emailToken();
    const other = await emailToken();
    expect((await merge(acct, {})).status).toBe(400);
    expect((await merge(acct, undefined)).status).toBe(400);
    expect((await merge(acct, { guestToken: "garbage" })).status).toBe(403);
    expect((await merge(acct, { guestToken: other })).status).toBe(403);
    expect((await merge(acct, { guestToken: acct })).status).toBe(403);
    expect((await merge(g, { guestToken: g })).status).toBe(403);
    expect(
      (await merge(await anonymousToken(), { guestToken: g })).status,
    ).toBe(403);
    expect((await merge(undefined, { guestToken: g })).status).toBe(401);
    // Nothing moved: the guest still owns its photo.
    expect(await listPhotos(uidOf(acct))).toEqual([]);
    expect(await listPhotos(uidOf(g))).toHaveLength(1);
  });

  it("a signed-in attacker cannot take someone else's guest data: a uid in the body does nothing", async () => {
    const { g, jobId } = await guestWithTryOn();
    const attacker = await emailToken();
    const res = await merge(attacker, { guestUid: uidOf(g), guestToken: "x" });
    expect(res.status).toBe(403);
    const res2 = await merge(attacker, { guestUid: uidOf(g) });
    expect(res2.status).toBe(400);
    expect((await job(attacker, jobId)).status).toBe(404);
    expect(await listPhotos(uidOf(g))).toHaveLength(1);
  });
});

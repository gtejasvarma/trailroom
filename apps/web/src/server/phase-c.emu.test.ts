// Phase C server behaviour: account to open (tile vs full), try-ons list, one job at a time,
// provider failures, and kept try-ons across a purge.
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { firestore, getJob, getPoseSet } from "@trailroom/db";
import { listObjects } from "../../../../packages/pipeline/src/testkit";
import { getFakeCalls, POSES, setFakeScript } from "@trailroom/render";
import { POST as attachPOST } from "../app/api/account/attach/route";
import { GET as tryOnsGET } from "../app/api/try-ons/route";
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
const tryOn = (t: string, itemId: string) =>
  tryOnPOST(req("POST", "/api/try-on", { token: t, json: { itemId } }));
const render = (t: string, setId: string, pose: string, query = "") =>
  renderGET(
    req("GET", `/api/renders/${setId}/${pose}${query}`, { token: t }),
    params({ poseSetId: setId, pose }),
  );

async function finish(t: string, itemId: string) {
  const res = await tryOn(t, itemId);
  const body = await res.json();
  expect(res.status).toBe(202);
  await waitForJob(body.jobId, getJob);
  return body as { jobId: string; poseSetId: string };
}
async function person(kind: "guest" | "user") {
  const t = kind === "guest" ? await anonymousToken() : await emailToken();
  await uploadOk(t);
  return t;
}
const longSide = async (b: Buffer) => {
  const m = await sharp(b).metadata();
  return { side: Math.max(m.width!, m.height!), format: m.format };
};

describe("account to open", () => {
  it("a guest owner gets the tile for every pose and 403 account_required for full size", async () => {
    const g = await person("guest");
    const { poseSetId } = await finish(g, "blouse");
    expect((await getPoseSet(poseSetId))!.status).toBe("complete");
    for (const pose of POSE_LIST) {
      const tile = await render(g, poseSetId, pose, "?size=tile");
      expect(tile.status).toBe(200);
      expect(tile.headers.get("cache-control")).toBe("private, no-store");
      expect(tile.headers.get("content-type")).toBe("image/jpeg");
      const { side, format } = await longSide(
        Buffer.from(await tile.arrayBuffer()),
      );
      expect(side).toBeLessThanOrEqual(320);
      expect(format).toBe("jpeg");
      for (const q of ["", "?size=full"]) {
        const full = await render(g, poseSetId, pose, q);
        expect([full.status, (await full.json()).error]).toEqual([
          403,
          "account_required",
        ]);
      }
    }
    const bad = await render(g, poseSetId, "front", "?size=huge");
    expect(bad.status).toBe(400);
  });

  it("forged and foreign pose-set ids are 404 at both sizes", async () => {
    const g = await person("guest");
    const u = await person("user");
    const mine = await finish(g, "blouse");
    const theirs = await finish(u, "blouse");
    for (const q of ["", "?size=tile"]) {
      expect((await render(g, theirs.poseSetId, "front", q)).status).toBe(404);
      expect((await render(g, "nope_nope_nope", "front", q)).status).toBe(404);
      expect((await render(u, mine.poseSetId, "front", q)).status).toBe(404);
    }
  });

  it("a signed-in owner gets full size; another signed-in user gets 404", async () => {
    const u = await person("user");
    const other = await person("user");
    const { poseSetId } = await finish(u, "blouse");
    const full = await render(u, poseSetId, "front");
    expect(full.status).toBe(200);
    expect((await longSide(Buffer.from(await full.arrayBuffer()))).side).toBe(
      1024,
    );
    const tile = await render(u, poseSetId, "front", "?size=tile");
    expect(tile.status).toBe(200);
    expect(await render(other, poseSetId, "front")).toHaveProperty(
      "status",
      404,
    );
    expect((await render(other, poseSetId, "front", "?size=tile")).status).toBe(
      404,
    );
  });

  it("a failed set serves nothing at either size", async () => {
    setFakeScript([{ outcome: "error" }]);
    const g = await person("guest");
    const { poseSetId } = await finish(g, "blouse");
    for (const q of ["", "?size=tile"]) {
      expect((await render(g, poseSetId, "front", q)).status).toBe(404);
    }
    expect(await listObjects("renders/")).toEqual([]);
  });
});

describe("provider failures (F1) through the API", () => {
  const failureOf = async (t: string, jobId: string) => {
    const res = await jobGET(
      req("GET", `/api/jobs/${jobId}`, { token: t }),
      params({ jobId }),
    );
    return (await res.json()).failure.code as string;
  };
  it("every call erroring ends as internal", async () => {
    setFakeScript([{ outcome: "error" }]);
    const t = await person("user");
    const { jobId } = await finish(t, "blouse");
    expect(await failureOf(t, jobId)).toBe("internal");
  });
  it("a mix of errors and blank images ends as render_failed", async () => {
    setFakeScript([
      { pose: "front", outcome: "error" },
      { pose: "three-quarter", outcome: "error" },
      { pose: "walking", outcome: "blank" },
      { pose: "seated", outcome: "error" },
    ]);
    const t = await person("user");
    const { jobId } = await finish(t, "blouse");
    expect(await failureOf(t, jobId)).toBe("render_failed");
  });
});

describe("GET /api/try-ons", () => {
  it("returns only the caller's finished sets, newest first", async () => {
    const a = await person("user");
    const b = await person("user");
    const first = await finish(a, "blouse");
    const second = await finish(a, "vest");
    await finish(b, "blouse");
    setFakeScript([{ outcome: "error" }]);
    await finish(a, "coat"); // failed: must not be listed
    const res = await tryOnsGET(req("GET", "/api/try-ons", { token: a }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tryOns.map((t: { poseSetId: string }) => t.poseSetId)).toEqual([
      second.poseSetId,
      first.poseSetId,
    ]);
    expect(body.tryOns[0].poses).toEqual(POSE_LIST);
    expect((await tryOnsGET(req("GET", "/api/try-ons"))).status).toBe(401);
  });
});

describe("one job at a time", () => {
  it("a second start for another piece while one renders is refused: no job, no spend", async () => {
    setFakeScript([{ outcome: "ok", delayMs: 600 }]);
    const t = await person("user");
    const first = await tryOn(t, "blouse");
    expect(first.status).toBe(202);
    const second = await tryOn(t, "vest");
    const body = await second.json();
    expect([second.status, body.error]).toEqual([409, "job_in_progress"]);
    await waitForJob((await first.json()).jobId, getJob);
    expect(getFakeCalls()).toHaveLength(4);
    const jobs = await firestore()
      .collection("jobs")
      .where("uid", "==", uidOf(t))
      .get();
    expect(jobs.size).toBe(1);
    // Once it is done the next piece starts.
    expect((await tryOn(t, "vest")).status).toBe(202);
  });
});

describe("kept try-ons", () => {
  it("attach promotes every record and a purge run deletes nothing of theirs", async () => {
    const t = await person("user");
    const uid = uidOf(t);
    const { poseSetId, jobId } = await finish(t, "blouse");
    const db = firestore();
    const past = new Date("2020-01-01T00:00:00Z");
    // Put every record back into the state it has while the person is a guest.
    await db
      .collection("photos")
      .doc(uid)
      .update({ isGuest: true, expiresAt: past });
    for (const d of (
      await db.collection("photos").doc(uid).collection("items").get()
    ).docs)
      await d.ref.update({ isGuest: true, expiresAt: past });
    await db
      .collection("jobs")
      .doc(jobId)
      .update({ isGuest: true, expiresAt: past });
    await db.collection("poseSets").doc(poseSetId).update({ expiresAt: past });

    const ok = await attachPOST(
      req("POST", "/api/account/attach", { token: t }),
    );
    expect(ok.status).toBe(200);

    expect((await db.collection("photos").doc(uid).get()).data()).toMatchObject(
      {
        isGuest: false,
        expiresAt: null,
      },
    );
    for (const d of (
      await db.collection("photos").doc(uid).collection("items").get()
    ).docs)
      expect(d.data()).toMatchObject({ isGuest: false, expiresAt: null });
    expect((await db.collection("jobs").doc(jobId).get()).data()).toMatchObject(
      {
        isGuest: false,
        expiresAt: null,
      },
    );
    expect((await getPoseSet(poseSetId))!.expiresAt).toBeNull();

    const result = await purgeExpiredGuests(new Date("2099-01-01T00:00:00Z"));
    expect(result.purged).toBe(0);
    expect(await getJob(jobId)).not.toBeNull();
    expect((await getPoseSet(poseSetId))!.status).toBe("complete");
    expect(await listObjects(`renders/${uid}/`)).toHaveLength(4);
    expect((await render(t, poseSetId, "front")).status).toBe(200);
  });

  it("control: a guest who never linked is purged with their renders", async () => {
    const g = await person("guest");
    const { poseSetId } = await finish(g, "blouse");
    const uid = uidOf(g);
    const result = await purgeExpiredGuests(new Date("2099-01-01T00:00:00Z"));
    expect(result.purged).toBe(1);
    expect(await getPoseSet(poseSetId)).toBeNull();
    expect(await listObjects(`renders/${uid}/`)).toEqual([]);
  });
});

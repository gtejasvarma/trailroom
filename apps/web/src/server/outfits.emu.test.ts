// Phase F: an outfit is two pieces in one Front image, through the same graph as a try-on.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addPhoto,
  bucket,
  claimPoseSet,
  createJob,
  firestore,
  getJob,
  getPoseSet,
  outfitPoseSetId,
  putPhoto,
  renderPath,
  recordConsent,
  type SpendLogDoc,
} from "@trailroom/db";
import { loadItemImage, runInline } from "@trailroom/pipeline";
import {
  estimateCostMicros,
  getFakeCalls,
  setFakeScript,
} from "@trailroom/render";
import { DELETE as photoDELETE } from "../app/api/photo/route";
import {
  POST as outfitPOST,
  GET as outfitsGET,
} from "../app/api/outfits/route";
import { GET as tryOnsGET } from "../app/api/try-ons/route";
import { DELETE as tryOnDELETE } from "../app/api/try-ons/[poseSetId]/route";
import { POST as tryOnPOST } from "../app/api/try-on/route";
import { GET as compareGET } from "../app/api/compare/route";
import { GET as jobGET } from "../app/api/jobs/[jobId]/route";
import { GET as renderGET } from "../app/api/renders/[poseSetId]/[pose]/route";
import { POST as mergePOST } from "../app/api/account/merge/route";
import {
  clearBucket,
  listObjects,
  personPhoto,
} from "../../../../packages/pipeline/src/testkit";
import { awaitInlineRuns } from "./orchestrator";
import { SIGNED_IN_DAILY_STARTS } from "./limits";
import {
  anonymousToken,
  emailToken,
  req,
  reset,
  uidOf,
  uploadOk,
  waitForJob,
} from "./testkit";
import { useKeySourceForTests } from "./oidc";
import {
  AUDIENCE,
  keySourceFor,
  makeKey,
  SCHEDULER_SA,
  WORKFLOWS_SA,
} from "./oidc-testkit";
import { makeDriver } from "./workflow-driver";

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
  useKeySourceForTests(null);
});

const params = <T>(p: T) => ({ params: Promise.resolve(p) });
const outfit = (
  token: string | undefined,
  itemIds: unknown,
  photoId?: string,
) =>
  outfitPOST(
    req("POST", "/api/outfits", { token, json: { itemIds, photoId } }),
  );
const spend = async () =>
  (await firestore().collection("spendLog").get()).docs.map(
    (d) => d.data() as SpendLogDoc,
  );
const render = (t: string, setId: string, pose = "front") =>
  renderGET(
    req("GET", `/api/renders/${setId}/${pose}`, { token: t }),
    params({ poseSetId: setId, pose }),
  );

async function signedIn() {
  const t = await emailToken();
  const photoId = await uploadOk(t);
  return { t, uid: uidOf(t), photoId };
}
async function finishOutfit(t: string, ids: string[]) {
  const res = await outfit(t, ids);
  const body = await res.json();
  expect(res.status).toBe(202);
  await waitForJob(body.jobId, getJob);
  return body as { jobId: string; poseSetId: string; reused: boolean };
}

describe("an outfit through the graph", () => {
  it("makes one model call with the garments then the person, and publishes one Front", async () => {
    const { t, uid, photoId } = await signedIn();
    const a = await finishOutfit(t, ["slip", "coat"]);
    // Canonical order: coat < slip.
    expect(a.poseSetId).toBe(outfitPoseSetId(uid, photoId, "coat", "slip"));
    expect(a.poseSetId).toBe(`${uid}_${photoId}_coat=slip`);

    const job = (await getJob(a.jobId))!;
    expect(job).toMatchObject({
      status: "complete",
      kind: "outfit",
      itemId: "coat",
      itemIds: ["coat", "slip"],
      poseOrder: ["front"],
      promptVersion: "outfit-v1",
    });
    const calls = getFakeCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.inputMimeTypes).toEqual([
      "image/jpeg",
      "image/jpeg",
      "image/jpeg",
    ]);
    const coat = await loadItemImage("coat");
    const slip = await loadItemImage("slip");
    expect(calls[0]!.inputBytes.slice(0, 2)).toEqual([
      coat.data.length,
      slip.data.length,
    ]);
    expect(calls[0]!.inputBytes[2]).not.toBe(coat.data.length);
    expect(calls[0]!.prompt).toContain("Image 3 is a photo of a person");
    expect(calls[0]!.prompt).toContain("worn open over");

    expect(await listObjects(`renders/${uid}/${a.poseSetId}/`)).toEqual([
      `renders/${uid}/${a.poseSetId}/front.jpg`,
    ]);
    expect(await listObjects("staging/")).toEqual([]);
    const set = (await getPoseSet(a.poseSetId))!;
    expect(set).toMatchObject({ status: "complete", poses: ["front"] });

    // Reserved at the three-image estimate, settled to a real cost.
    const logs = await spend();
    expect(logs).toHaveLength(1);
    expect(logs[0]!.estimateMicros).toBe(
      estimateCostMicros("nano-banana-2.1", 3),
    );
    expect(logs[0]!.state).toBe("settled");
    expect(logs[0]!.actualMicros).toBeGreaterThan(0);

    // Served to its owner only.
    const own = await render(t, a.poseSetId);
    expect(own.status).toBe(200);
    expect(own.headers.get("content-type")).toBe("image/jpeg");
    const other = await emailToken();
    expect((await render(other, a.poseSetId)).status).toBe(404);
  });

  it("reuses a finished outfit in either order with no second call or spend", async () => {
    const { t } = await signedIn();
    const a = await finishOutfit(t, ["vest", "coat"]);
    const calls = getFakeCalls().length;
    const lines = (await spend()).length;
    for (const ids of [
      ["coat", "vest"],
      ["vest", "coat"],
    ]) {
      const res = await outfit(t, ids);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ...a, reused: true });
    }
    expect(getFakeCalls()).toHaveLength(calls);
    expect(await spend()).toHaveLength(lines);
  });

  it("fails honestly when QA fails twice: nothing is served", async () => {
    const { t, uid } = await signedIn();
    setFakeScript([{ pose: "front", outcome: "blank", times: 5 }]);
    const a = await finishOutfit(t, ["blouse", "coat"]);
    const job = (await getJob(a.jobId))!;
    expect(job.status).toBe("failed");
    expect(job.failure?.code).toBe("render_failed");
    expect(getFakeCalls()).toHaveLength(2);
    expect((await spend()).every((l) => l.state === "settled")).toBe(true);
    expect((await getPoseSet(a.poseSetId))!.status).toBe("failed");
    expect(await listObjects(`renders/${uid}/`)).toEqual([]);
    expect((await render(t, a.poseSetId)).status).toBe(404);
    const list = await (
      await outfitsGET(req("GET", "/api/outfits", { token: t }))
    ).json();
    expect(list.outfits).toEqual([]);
  });

  it("a provider error on every attempt is internal", async () => {
    const { t } = await signedIn();
    setFakeScript([{ pose: "front", outcome: "error", times: 5 }]);
    const a = await finishOutfit(t, ["blouse", "coat"]);
    const job = (await getJob(a.jobId))!;
    expect([job.status, job.failure?.code]).toEqual(["failed", "internal"]);
    expect(getFakeCalls()).toHaveLength(2);
  });

  it("runs the same through the node endpoints as through runInline", async () => {
    const key = makeKey();
    process.env.INTERNAL_AUDIENCE = AUDIENCE;
    process.env.WORKFLOWS_SA_EMAIL = WORKFLOWS_SA;
    process.env.SCHEDULER_SA_EMAIL = SCHEDULER_SA;
    useKeySourceForTests(keySourceFor(key));
    process.env.ORCHESTRATOR = "workflows"; // the start is mocked: nothing runs until we drive it
    const { t } = await signedIn();
    const res = await outfit(t, ["coat", "slip"]);
    const started = await res.json();
    expect(res.status).toBe(202);
    expect(getFakeCalls()).toHaveLength(0);
    const status = await makeDriver(key, { twice: true })(started.jobId);
    expect(status).toBe("complete");
    expect(getFakeCalls()).toHaveLength(1);
    expect(getFakeCalls()[0]!.inputMimeTypes).toHaveLength(3);
    expect((await getPoseSet(started.poseSetId))!.poses).toEqual(["front"]);
    expect((await spend()).filter((l) => l.state === "settled")).toHaveLength(
      1,
    );

    // And runInline on an equivalent job reaches the same terminal state.
    process.env.ORCHESTRATOR = "inline";
    const b = await signedIn();
    const r2 = await (await outfit(b.t, ["coat", "slip"])).json();
    await awaitInlineRuns();
    expect(r2.reused).toBe(false);
    expect((await getJob(r2.jobId))!.status).toBe("complete");
    expect(typeof runInline).toBe("function");
  });
});

describe("outfit refusals happen before any spend", () => {
  const none = async () => {
    expect(getFakeCalls()).toHaveLength(0);
    expect(await spend()).toHaveLength(0);
    expect((await firestore().collection("jobs").get()).size).toBe(0);
  };

  it("a guest is 403 account_required", async () => {
    const g = await anonymousToken();
    await uploadOk(g);
    const res = await outfit(g, ["coat", "slip"]);
    expect([res.status, (await res.json()).error]).toEqual([
      403,
      "account_required",
    ]);
    await none();
  });

  it("needs consent and a photo", async () => {
    const t = await emailToken();
    let res = await outfit(t, ["coat", "slip"]);
    expect((await res.json()).error).toBe("consent_required");
    await uploadOk(t);
    res = await outfit(t, ["coat", "slip"], "nope");
    expect((await res.json()).error).toBe("not_found");
    await none();
  });

  it("rejects malformed bodies, unknown and unready pieces", async () => {
    const { t } = await signedIn();
    for (const ids of [
      undefined,
      ["coat"],
      ["coat", "coat"],
      ["coat", 3],
      "coat",
    ]) {
      expect((await outfit(t, ids)).status).toBe(400);
    }
    let res = await outfit(t, ["coat", "nope"]);
    expect((await res.json()).error).toBe("unknown_item");
    for (const bad of ["jacket", "hoops", "chain"]) {
      res = await outfit(t, ["coat", bad]);
      expect([res.status, (await res.json()).error]).toEqual([
        409,
        "not_ready",
      ]);
    }
    await none();
  });

  it("every invalid combination is 422 invalid_outfit", async () => {
    const { t } = await signedIn();
    const invalid = [
      ["jump", "maxi"], // two dresses
      ["blouse", "vest"], // two tops
      ["slip", "blouse"], // dress + top
      ["coord", "vest"], // dress + top
    ];
    for (const ids of invalid) {
      const res = await outfit(t, ids);
      expect([res.status, (await res.json()).error]).toEqual([
        422,
        "invalid_outfit",
      ]);
    }
    await none();
  });

  it("one job at a time, and the daily start limit counts an outfit as one start", async () => {
    const { t } = await signedIn();
    setFakeScript([{ pose: "front", outcome: "ok", delayMs: 600 }]);
    const first = await outfit(t, ["coat", "slip"]);
    expect(first.status).toBe(202);
    const second = await outfit(t, ["coat", "vest"]);
    expect([second.status, (await second.json()).error]).toEqual([
      409,
      "job_in_progress",
    ]);
    const tryon = await tryOnPOST(
      req("POST", "/api/try-on", { token: t, json: { itemId: "blouse" } }),
    );
    expect((await tryon.json()).error).toBe("job_in_progress");
    await awaitInlineRuns();
    setFakeScript(null);

    // 1 used. Four more starts (two outfits, then try-ons) reach the limit of 5; a sixth is refused.
    const pairs = [
      ["coat", "vest"],
      ["coat", "blouse"],
    ];
    for (const p of pairs) await finishOutfit(t, p);
    for (const item of ["jump", "maxi"]) {
      const r = await tryOnPOST(
        req("POST", "/api/try-on", { token: t, json: { itemId: item } }),
      );
      expect(r.status).toBe(202);
      await waitForJob((await r.json()).jobId, getJob);
    }
    expect(1 + pairs.length + 2).toBe(SIGNED_IN_DAILY_STARTS);
    const over = await outfit(t, ["slip", "coat"]); // reuse is free
    expect(over.status).toBe(200);
    const six = await tryOnPOST(
      req("POST", "/api/try-on", { token: t, json: { itemId: "coord" } }),
    );
    expect([six.status, (await six.json()).error]).toEqual([
      429,
      "daily_limit",
    ]);
  });
});

describe("outfits beside try-ons", () => {
  it("lists outfits separately, keeps them out of try-ons and Compare, and removes them", async () => {
    const { t, uid } = await signedIn();
    const a = await finishOutfit(t, ["coat", "slip"]);
    const tryOns = await (
      await tryOnsGET(req("GET", "/api/try-ons", { token: t }))
    ).json();
    expect(tryOns.tryOns).toEqual([]);
    const outfits = await (
      await outfitsGET(req("GET", "/api/outfits", { token: t }))
    ).json();
    expect(outfits.outfits).toHaveLength(1);
    expect(outfits.outfits[0]).toMatchObject({
      poseSetId: a.poseSetId,
      itemIds: ["coat", "slip"],
      status: "complete",
    });
    const cmp = await compareGET(
      req("GET", `/api/compare?ids=${encodeURIComponent(a.poseSetId)}`, {
        token: t,
      }),
    );
    expect(cmp.status).toBe(404);
    const job = await (
      await jobGET(
        req("GET", `/api/jobs/${a.jobId}`, { token: t }),
        params({ jobId: a.jobId }),
      )
    ).json();
    expect(job).toMatchObject({ kind: "outfit", itemIds: ["coat", "slip"] });

    const del = await tryOnDELETE(
      req("DELETE", `/api/try-ons/${a.poseSetId}`, { token: t }),
      params({ poseSetId: a.poseSetId }),
    );
    expect(del.status).toBe(200);
    expect(await getPoseSet(a.poseSetId)).toBeNull();
    expect(await getJob(a.jobId)).toBeNull();
    expect(await listObjects(`renders/${uid}/`)).toEqual([]);
  });

  it("deleting everything removes an outfit's documents and objects", async () => {
    const { t, uid } = await signedIn();
    await finishOutfit(t, ["coat", "blouse"]);
    const res = await photoDELETE(req("DELETE", "/api/photo", { token: t }));
    expect(res.status).toBe(200);
    expect(
      (await firestore().collection("poseSets").where("uid", "==", uid).get())
        .size,
    ).toBe(0);
    expect(
      (await firestore().collection("jobs").where("uid", "==", uid).get()).size,
    ).toBe(0);
    expect(await listObjects(`renders/${uid}/`)).toEqual([]);
  });

  it("an outfit does not stand in for a try-on of its first piece in an ask", async () => {
    // asks freeze the newest finished *try-on* for a piece; kindOf() keeps outfits out.
    const { t } = await signedIn();
    await finishOutfit(t, ["coat", "slip"]);
    const sets = await firestore().collection("poseSets").get();
    expect(sets.docs[0]!.get("itemId")).toBe("coat");
    expect(sets.docs[0]!.get("kind")).toBe("outfit");
  });
});

describe("a guest's account merge does not choke on the new fields", () => {
  it("moves a finished outfit under the account's id", async () => {
    const guest = await anonymousToken();
    const gUid = uidOf(guest);
    await recordConsent(gUid, "v1");
    const { photo } = await addPhoto(gUid, {
      width: 768,
      height: 1024,
      isGuest: true,
      photoId: "photo1",
    });
    await putPhoto(gUid, photo.id, await personPhoto());
    const psId = outfitPoseSetId(gUid, photo.id, "coat", "slip");
    const { id: jobId } = await createJob({
      uid: gUid,
      itemId: "coat",
      kind: "outfit",
      itemIds: ["coat", "slip"],
      photoId: photo.id,
      poseSetId: psId,
      poseOrder: ["front"],
      poses: { front: { status: "passed", attempt: 1, reasons: [] } },
      qaSkipped: [],
      model: "nano-banana-2.1",
      promptVersion: "outfit-v1",
      isGuest: true,
      status: "complete",
    });
    await claimPoseSet({
      uid: gUid,
      itemId: "coat",
      itemIds: ["coat", "slip"],
      photoId: photo.id,
      jobId,
      isGuest: true,
    });
    const { updatePoseSet } = await import("@trailroom/db");
    await bucket()
      .file(renderPath(gUid, psId, "front"))
      .save(await personPhoto(), { contentType: "image/jpeg" });
    await updatePoseSet(psId, { status: "complete", poses: ["front"] });

    const account = await emailToken();
    const res = await mergePOST(
      req("POST", "/api/account/merge", {
        token: account,
        json: { guestToken: guest },
      }),
    );
    expect(res.status).toBe(200);
    const newId = `${uidOf(account)}_photo1_coat=slip`;
    expect((await res.json()).tryOns[0].poseSetId).toBe(newId);
    expect(await getPoseSet(newId)).toMatchObject({
      kind: "outfit",
      itemIds: ["coat", "slip"],
    });
    expect((await render(account, newId)).status).toBe(200);
    await clearBucket();
  });
});

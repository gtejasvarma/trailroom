// Phase E server behaviour: removing a try-on, Delete everything (now with purchases and the
// sign-in), the compare data endpoint, and Buy / did-it-arrive.
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  auth,
  firestore,
  getJob,
  getPoseSet,
  getRender,
  getUsage,
  listPhotos,
} from "@trailroom/db";
import { listObjects as listBucket } from "../../../../packages/pipeline/src/testkit";
import { getItem } from "@trailroom/catalog";
import { loadCatalogFile } from "@trailroom/pipeline";
import { setFakeScript } from "@trailroom/render";
import { POST as attachPOST } from "../app/api/account/attach/route";
import { DELETE as accountDELETE } from "../app/api/photo/route";
import { GET as tryOnsGET } from "../app/api/try-ons/route";
import { DELETE as tryOnDELETE } from "../app/api/try-ons/[poseSetId]/route";
import { GET as compareGET } from "../app/api/compare/route";
import {
  GET as purchasesGET,
  POST as purchasesPOST,
} from "../app/api/purchases/route";
import { POST as arrivedPOST } from "../app/api/purchases/[itemId]/arrived/route";
import { GET as imageGET } from "../app/api/ask/[token]/image/[itemId]/route";
import { POST as asksPOST } from "../app/api/asks/route";
import { POST as listsPOST } from "../app/api/lists/route";
import { PATCH as listPATCH } from "../app/api/lists/[id]/route";
import { POST as tryOnPOST } from "../app/api/try-on/route";
import { awaitInlineRuns } from "./orchestrator";
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

const p = <T>(v: T) => ({ params: Promise.resolve(v) });

async function person() {
  const token = await emailToken();
  await attachPOST(req("POST", "/api/account/attach", { token, json: {} }));
  await uploadOk(token);
  return { token, uid: uidOf(token) };
}
type Person = Awaited<ReturnType<typeof person>>;

async function tryOn(a: Person, itemId: string) {
  const res = await tryOnPOST(
    req("POST", "/api/try-on", { token: a.token, json: { itemId } }),
  );
  const body = await res.json();
  expect(res.status).toBe(202);
  await waitForJob(body.jobId, getJob);
  return body as { jobId: string; poseSetId: string };
}
const removeTryOn = (token: string, id: string) =>
  tryOnDELETE(
    req("DELETE", `/api/try-ons/${id}`, { token }),
    p({ poseSetId: id }),
  );
const compare = (token: string, ids: string) =>
  compareGET(req("GET", `/api/compare?ids=${ids}`, { token }));
const buy = (token: string, itemId: unknown) =>
  purchasesPOST(req("POST", "/api/purchases", { token, json: { itemId } }));
const answer = (token: string, itemId: string, json: unknown) =>
  arrivedPOST(
    req("POST", `/api/purchases/${itemId}/arrived`, { token, json }),
    p({ itemId }),
  );
const purchases = async (token: string) =>
  (await (await purchasesGET(req("GET", "/api/purchases", { token }))).json())
    .purchases as { itemId: string; arrived: boolean | null }[];
const tryOns = async (token: string) =>
  (await (await tryOnsGET(req("GET", "/api/try-ons", { token }))).json())
    .tryOns as { poseSetId: string }[];

describe("remove a try-on", () => {
  it("deletes the pose set, its renders and its job, and leaves the daily count alone", async () => {
    const a = await person();
    const keep = await tryOn(a, "coat");
    const gone = await tryOn(a, "blouse");
    const before = await getUsage(a.uid);
    expect(before!.starts).toBe(2);
    expect(await listBucket(`renders/${a.uid}/${gone.poseSetId}/`)).not.toEqual(
      [],
    );

    const res = await removeTryOn(a.token, gone.poseSetId);
    expect([res.status, await res.json()]).toEqual([200, { removed: true }]);

    expect(await getPoseSet(gone.poseSetId)).toBeNull();
    expect(await getJob(gone.jobId)).toBeNull();
    expect(await getRender(a.uid, gone.poseSetId, "front")).toBeNull();
    expect(await listBucket(`renders/${a.uid}/${gone.poseSetId}/`)).toEqual([]);
    expect(
      (await firestore().collection("jobInternals").doc(gone.jobId).get())
        .exists,
    ).toBe(false);
    // The other try-on is untouched, and the counter did not move.
    expect((await tryOns(a.token)).map((t) => t.poseSetId)).toEqual([
      keep.poseSetId,
    ]);
    expect(await getRender(a.uid, keep.poseSetId, "front")).not.toBeNull();
    expect((await getUsage(a.uid))!.starts).toBe(2);
    // The photo stays.
    expect(await listPhotos(a.uid)).toHaveLength(1);
    // Removing it again is a plain 404.
    expect((await removeTryOn(a.token, gone.poseSetId)).status).toBe(404);
  });

  it("another person gets 404 and nothing is touched; a guest is refused", async () => {
    const a = await person();
    const b = await person();
    const mine = await tryOn(a, "coat");
    expect((await removeTryOn(b.token, mine.poseSetId)).status).toBe(404);
    expect((await removeTryOn(b.token, "nope_nope_nope")).status).toBe(404);
    expect((await removeTryOn(b.token, "../x")).status).toBe(404);
    expect(await getPoseSet(mine.poseSetId)).not.toBeNull();
    expect(await getRender(a.uid, mine.poseSetId, "front")).not.toBeNull();
    const g = await anonymousToken();
    const res = await removeTryOn(g, mine.poseSetId);
    expect([res.status, (await res.json()).error]).toEqual([
      403,
      "account_required",
    ]);
    expect(await getPoseSet(mine.poseSetId)).not.toBeNull();
  });

  it("an ask that used it serves the label photo afterwards", async () => {
    const a = await person();
    const { poseSetId } = await tryOn(a, "blouse");
    const list = (
      await (
        await listsPOST(
          req("POST", "/api/lists", { token: a.token, json: { name: "Trip" } }),
        )
      ).json()
    ).list;
    await listPATCH(
      req("PATCH", `/api/lists/${list.id}`, {
        token: a.token,
        json: { add: "blouse" },
      }),
      p({ id: list.id }),
    );
    const made = await asksPOST(
      req("POST", "/api/asks", {
        token: a.token,
        json: { listId: list.id, itemIds: ["blouse"] },
      }),
    );
    expect(made.status).toBe(201);
    const token = ((await made.json()).url as string).split("/ask/")[1]!;
    const fetchImage = async () =>
      Buffer.from(
        await (
          await imageGET(
            req("GET", `/api/ask/${token}/image/blouse`),
            p({ token, itemId: "blouse" }),
          )
        ).arrayBuffer(),
      );
    const label = await sharp(
      (await loadCatalogFile(getItem("blouse")!.photos[0]!.file))!.data,
    )
      .rotate()
      .resize({
        width: 1200,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82 })
      .toBuffer();
    expect((await fetchImage()).equals(label)).toBe(false); // their render
    expect((await removeTryOn(a.token, poseSetId)).status).toBe(200);
    expect((await fetchImage()).equals(label)).toBe(true);
  });
});

describe("delete everything", () => {
  it("also removes purchases and the sign-in, and leaves another person's data intact", async () => {
    const a = await person();
    const b = await person();
    await tryOn(a, "coat");
    await tryOn(b, "coat");
    await buy(a.token, "coat");
    await buy(b.token, "coat");
    expect((await auth().getUser(a.uid)).uid).toBe(a.uid);

    const res = await accountDELETE(
      req("DELETE", "/api/photo", { token: a.token }),
    );
    expect(res.status).toBe(200);

    expect(
      (
        await firestore()
          .collection("purchases")
          .where("uid", "==", a.uid)
          .get()
      ).size,
    ).toBe(0);
    await expect(auth().getUser(a.uid)).rejects.toMatchObject({
      code: "auth/user-not-found",
    });
    expect(await listPhotos(a.uid)).toEqual([]);
    expect(await listBucket(`photos/${a.uid}/`)).toEqual([]);
    expect(await listBucket(`renders/${a.uid}/`)).toEqual([]);
    // Nothing of b's moved.
    expect((await auth().getUser(b.uid)).uid).toBe(b.uid);
    expect(await purchases(b.token)).toHaveLength(1);
    expect(await tryOns(b.token)).toHaveLength(1);
    expect(await listPhotos(b.uid)).toHaveLength(1);
    // A second delete is harmless.
    expect(
      (await accountDELETE(req("DELETE", "/api/photo", { token: b.token })))
        .status,
    ).toBe(200);
  });
});

describe("the compare data endpoint", () => {
  it("returns only the caller's finished sets, in the order asked", async () => {
    const a = await person();
    const c = await tryOn(a, "coat");
    const bl = await tryOn(a, "blouse");
    const res = await compare(a.token, `${bl.poseSetId},${c.poseSetId}`);
    expect(res.status).toBe(200);
    const { pieces } = await res.json();
    expect(pieces.map((x: { poseSetId: string }) => x.poseSetId)).toEqual([
      bl.poseSetId,
      c.poseSetId,
    ]);
    expect(pieces[0]).toMatchObject({
      itemId: "blouse",
      jobId: bl.jobId,
      poses: ["front", "three-quarter", "walking", "seated"],
    });
  });

  it("a three-pose set lists only its three poses", async () => {
    const a = await person();
    setFakeScript([{ pose: "walking", outcome: "blocked", times: 2 }]);
    const t = await tryOn(a, "coat");
    const { pieces } = await (await compare(a.token, t.poseSetId)).json();
    expect(pieces[0].poses).toEqual(["front", "three-quarter", "seated"]);
  });

  it("404 for anyone else's id (the whole request), 400 for bad or too many, 403 for a guest", async () => {
    const a = await person();
    const b = await person();
    const mine = await tryOn(a, "coat");
    const theirs = await tryOn(b, "coat");
    expect((await compare(a.token, theirs.poseSetId)).status).toBe(404);
    expect(
      (await compare(a.token, `${mine.poseSetId},${theirs.poseSetId}`)).status,
    ).toBe(404);
    expect((await compare(a.token, "nope_nope_nope")).status).toBe(404);
    expect((await compare(a.token, "")).status).toBe(400);
    expect((await compare(a.token, "a,b,c,d,e")).status).toBe(400);
    const g = await anonymousToken();
    const res = await compare(g, mine.poseSetId);
    expect([res.status, (await res.json()).error]).toEqual([
      403,
      "account_required",
    ]);
  });

  it("a set that is still rendering or failed is 404", async () => {
    const a = await person();
    setFakeScript([{ outcome: "blocked" }]);
    const res = await tryOnPOST(
      req("POST", "/api/try-on", { token: a.token, json: { itemId: "coat" } }),
    );
    const t = await res.json();
    await waitForJob(t.jobId, getJob);
    expect((await compare(a.token, t.poseSetId)).status).toBe(404);
  });
});

describe("buy and did it arrive", () => {
  it("records the intent once, and a second press keeps the first record", async () => {
    const a = await person();
    const first = await buy(a.token, "coat");
    expect(first.status).toBe(201);
    const one = await first.json();
    expect(one.purchase).toMatchObject({ itemId: "coat", arrived: null });
    const again = await buy(a.token, "coat");
    expect(again.status).toBe(200);
    const two = await again.json();
    expect([two.created, two.purchase.clickedAt]).toEqual([
      false,
      one.purchase.clickedAt,
    ]);
    const doc = await firestore()
      .collection("purchases")
      .doc(`${a.uid}_coat`)
      .get();
    expect(doc.data()).toMatchObject({
      uid: a.uid,
      itemId: "coat",
      arrived: null,
    });
    expect((await firestore().collection("purchases").get()).size).toBe(1);
  });

  it("refuses guests and unknown pieces", async () => {
    const g = await anonymousToken();
    expect((await buy(g, "coat")).status).toBe(403);
    expect(
      (await purchasesGET(req("GET", "/api/purchases", { token: g }))).status,
    ).toBe(403);
    const a = await person();
    expect((await buy(a.token, "nope")).status).toBe(404);
    expect((await buy(a.token, 7)).status).toBe(404);
  });

  it("stores the answer once and never changes it", async () => {
    const a = await person();
    expect((await answer(a.token, "coat", { arrived: true })).status).toBe(404);
    await buy(a.token, "coat");
    expect((await answer(a.token, "coat", { arrived: "yes" })).status).toBe(
      400,
    );
    const ok = await answer(a.token, "coat", { arrived: false });
    expect(ok.status).toBe(200);
    expect((await ok.json()).purchase.arrived).toBe(false);
    const second = await answer(a.token, "coat", { arrived: true });
    expect([second.status, (await second.json()).error]).toEqual([
      409,
      "already_answered",
    ]);
    expect(await purchases(a.token)).toEqual([
      expect.objectContaining({ itemId: "coat", arrived: false }),
    ]);
    // Pressing Buy again does not reopen the question.
    await buy(a.token, "coat");
    expect((await purchases(a.token))[0]!.arrived).toBe(false);
  });

  it("another person can neither read nor change it", async () => {
    const a = await person();
    const b = await person();
    await buy(a.token, "coat");
    expect(await purchases(b.token)).toEqual([]);
    expect((await answer(b.token, "coat", { arrived: true })).status).toBe(404);
    expect((await purchases(a.token))[0]!.arrived).toBeNull();
    // b's own record for the same piece is separate.
    await buy(b.token, "coat");
    await answer(b.token, "coat", { arrived: true });
    expect((await purchases(a.token))[0]!.arrived).toBeNull();
  });
});

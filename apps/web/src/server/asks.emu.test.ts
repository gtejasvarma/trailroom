// Asks: creation rules, the token, public lookup, votes (concurrency, changes, one per voter),
// the image route, expiry and revocation, the inbox, and what leaves with "Delete everything".
import { createHash } from "node:crypto";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ASK_RETENTION_MS,
  MAX_LIVE_ASKS,
  createAskFor,
  castVote,
  newAskToken,
  deletePoseSet,
  firestore,
  getAskByToken,
  getJob,
  getRender,
  listPhotos,
  updatePoseSet,
  type ListWithId,
} from "@trailroom/db";
import { loadCatalogFile } from "@trailroom/pipeline";
import { getItem } from "@trailroom/catalog";
import { setFakeScript } from "@trailroom/render";
import { POST as attachPOST } from "../app/api/account/attach/route";
import { DELETE as accountDELETE } from "../app/api/photo/route";
import { DELETE as photoDELETE } from "../app/api/photos/[photoId]/route";
import { GET as asksGET, POST as asksPOST } from "../app/api/asks/route";
import { POST as revokePOST } from "../app/api/asks/[id]/revoke/route";
import { GET as askGET } from "../app/api/ask/[token]/route";
import { POST as votePOST } from "../app/api/ask/[token]/vote/route";
import { GET as imageGET } from "../app/api/ask/[token]/image/[itemId]/route";
import { GET as inboxGET } from "../app/api/inbox/route";
import { GET as inboxDetailGET } from "../app/api/inbox/[askId]/route";
import { POST as inboxVotePOST } from "../app/api/inbox/[askId]/vote/route";
import { GET as inboxImageGET } from "../app/api/inbox/[askId]/image/[itemId]/route";
import { DELETE as listDELETE } from "../app/api/lists/[id]/route";
import { POST as listsPOST } from "../app/api/lists/route";
import { POST as tryOnPOST } from "../app/api/try-on/route";
import { awaitInlineRuns } from "./orchestrator";
import { purgeExpiredGuests } from "./purge";
import { PUBLIC_ASK_HEADERS } from "./ask-public";
import { emailToken, req, reset, uidOf, uploadOk, waitForJob } from "./testkit";

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
let ip = 0;
const fresh = () => ({
  "x-forwarded-for": `10.9.${Math.floor(ip / 250)}.${ip++ % 250}`,
});

async function person() {
  const token = await emailToken();
  await attachPOST(req("POST", "/api/account/attach", { token, json: {} }));
  return { token, uid: uidOf(token) };
}
type Person = Awaited<ReturnType<typeof person>>;

async function withPhoto() {
  const a = await person();
  await uploadOk(a.token);
  return a;
}

async function tryOn(t: string, itemId: string) {
  const res = await tryOnPOST(
    req("POST", "/api/try-on", { token: t, json: { itemId } }),
  );
  const body = await res.json();
  expect(res.status).toBe(202);
  await waitForJob(body.jobId, getJob);
  return body as { jobId: string; poseSetId: string };
}

async function makeList(
  a: Person,
  items: string[],
  name = "Wedding in September",
) {
  const r = await listsPOST(
    req("POST", "/api/lists", { token: a.token, json: { name } }),
  );
  const { list } = await r.json();
  const { PATCH } = await import("../app/api/lists/[id]/route");
  for (const i of items)
    await PATCH(
      req("PATCH", `/api/lists/${list.id}`, {
        token: a.token,
        json: { add: i },
      }),
      p({ id: list.id }),
    );
  return list.id as string;
}

async function ask(
  a: Person,
  listId: string,
  itemIds: string[],
  question?: string,
) {
  const res = await asksPOST(
    req("POST", "/api/asks", {
      token: a.token,
      json: { listId, itemIds, question },
    }),
  );
  const body = await res.json();
  return {
    res,
    body,
    token: res.status === 201 ? (body.url as string).split("/ask/")[1]! : "",
  };
}

const view = (token: string, opts: { bearer?: string; cookie?: string } = {}) =>
  askGET(
    req("GET", `/api/ask/${token}`, {
      token: opts.bearer,
      headers: opts.cookie ? { cookie: opts.cookie } : {},
    }),
    p({ token }),
  );
const vote = (
  token: string,
  itemId: unknown,
  opts: {
    bearer?: string;
    cookie?: string;
    headers?: Record<string, string>;
  } = {},
) =>
  votePOST(
    req("POST", `/api/ask/${token}/vote`, {
      token: opts.bearer,
      json: { itemId },
      headers: {
        ...fresh(),
        ...(opts.cookie ? { cookie: opts.cookie } : {}),
        ...(opts.headers ?? {}),
      },
    }),
    p({ token }),
  );
const image = (token: string, itemId: string, query = "") =>
  imageGET(
    req("GET", `/api/ask/${token}/image/${itemId}${query}`),
    p({ token, itemId }),
  );
const myAsks = async (a: Person) =>
  (await (await asksGET(req("GET", "/api/asks", { token: a.token }))).json())
    .asks as {
    askId: string;
    counts: Record<string, number>;
    state: string;
    total: number;
  }[];
const cookieOf = (res: Response) =>
  /trailroom_voter=([^;]+)/.exec(res.headers.get("set-cookie") ?? "")?.[1];

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const bytes = async (r: Response) => Buffer.from(await r.arrayBuffer());
const dump = async (collection: string) =>
  (await firestore().collection(collection).get()).docs.map((d) => d.data());

async function labelBytes(itemId: string) {
  const obj = await loadCatalogFile(getItem(itemId)!.photos[0]!.file);
  return sharp(obj!.data)
    .rotate()
    .resize({
      width: 1200,
      height: 1200,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 82 })
    .toBuffer();
}

describe("creating an ask", () => {
  it("returns the link once; only its hash is stored; the hash finds the ask", async () => {
    const a = await person();
    const listId = await makeList(a, ["coat", "slip"]);
    const { res, body, token } = await ask(
      a,
      listId,
      ["coat", "slip"],
      "Which one for Saturday?",
    );
    expect(res.status).toBe(201);
    expect(body.url).toMatch(/^http:\/\/localhost\/ask\/[A-Za-z0-9_-]{43}$/);
    expect(Object.keys(body).sort()).toEqual(["askId", "url"]);

    const docs = await dump("asks");
    expect(docs).toHaveLength(1);
    expect(JSON.stringify(docs)).not.toContain(token);
    expect(docs[0]!.tokenHash).toBe(sha(token));
    expect(docs[0]!.question).toBe("Which one for Saturday?");
    expect((await getAskByToken(token))!.id).toBe(body.askId);
    // No list of asks, anywhere, includes the token either.
    expect(JSON.stringify(await myAsks(a))).not.toContain(token);
  });

  it("only from the person's own list and the pieces in it", async () => {
    const a = await person();
    const b = await person();
    const listId = await makeList(a, ["coat", "slip"]);
    expect((await ask(b, listId, ["coat"])).res.status).toBe(404);
    expect((await ask(a, "nope_nope", ["coat"])).res.status).toBe(404);
    for (const items of [
      [],
      ["jacket"],
      ["coat", "coat"],
      ["coat", "slip", "x", "y", "z"],
      "coat",
    ]) {
      expect(
        (await ask(a, listId, items as string[])).res.status,
        JSON.stringify(items),
      ).toBe(400);
    }
    expect((await ask(a, listId, ["coat"], "x".repeat(121))).res.status).toBe(
      400,
    );
    expect((await ask(a, listId, ["coat"], "x".repeat(120))).res.status).toBe(
      201,
    );
    const guest = await (await import("./testkit")).anonymousToken();
    const g = await asksPOST(
      req("POST", "/api/asks", {
        token: guest,
        json: { listId, itemIds: ["coat"] },
      }),
    );
    expect(g.status).toBe(403);
  });

  it("allows 20 live asks per person; revoking frees a place", async () => {
    const a = await person();
    const listId = await makeList(a, ["coat"]);
    const ids: string[] = [];
    for (let i = 0; i < MAX_LIVE_ASKS; i++)
      ids.push((await ask(a, listId, ["coat"])).body.askId);
    const over = await ask(a, listId, ["coat"]);
    expect([over.res.status, over.body.error]).toEqual([409, "ask_limit"]);
    await revokePOST(
      req("POST", `/api/asks/${ids[0]}/revoke`, { token: a.token }),
      p({ id: ids[0]! }),
    );
    expect((await ask(a, listId, ["coat"])).res.status).toBe(201);
  });

  it("freezes the finished try-on per piece; a piece without one shows the label's photo", async () => {
    const a = await withPhoto();
    const { poseSetId } = await tryOn(a.token, "blouse");
    const listId = await makeList(a, ["blouse", "coat"]);
    const { token, body } = await ask(a, listId, ["blouse", "coat"]);
    const docs = (
      await firestore().collection("asks").doc(body.askId).get()
    ).data()!;
    expect(docs.poseSetIds).toEqual({ blouse: poseSetId, coat: null });
    const v = await (await view(token)).json();
    expect(
      v.pieces.map((x: { itemId: string; rendered: boolean }) => [
        x.itemId,
        x.rendered,
      ]),
    ).toEqual([
      ["blouse", true],
      ["coat", false],
    ]);
  });

  it("another person cannot revoke it", async () => {
    const a = await person();
    const b = await person();
    const { body, token } = await ask(a, await makeList(a, ["coat"]), ["coat"]);
    const r = await revokePOST(
      req("POST", `/api/asks/${body.askId}/revoke`, { token: b.token }),
      p({ id: body.askId }),
    );
    expect(r.status).toBe(404);
    expect((await view(token)).status).toBe(200);
  });
});

describe("the public page's data", () => {
  it("has the headers, shows the first name, and holds back the split until you vote", async () => {
    const a = await person();
    const { token } = await ask(
      a,
      await makeList(a, ["coat", "slip"]),
      ["coat", "slip"],
      "Which?",
    );
    const res = await view(token);
    expect(res.status).toBe(200);
    for (const [k, v] of Object.entries(PUBLIC_ASK_HEADERS))
      expect(res.headers.get(k)).toBe(v);
    const v = await res.json();
    expect(v).toMatchObject({
      askerFirstName: "A friend",
      question: "Which?",
      myVote: null,
      isAsker: false,
      counts: null,
    });
    expect(v.pieces[0]).toEqual({
      itemId: "coat",
      name: "Wool car coat",
      label: expect.any(String),
      priceUsd: 328,
      rendered: false,
      imageUrl: `/api/ask/${token}/image/coat`,
    });
  });

  it("unknown, garbage and over-long tokens are 404 and the page data says nothing else", async () => {
    for (const t of [
      "x",
      "a".repeat(44),
      "a".repeat(500),
      "../../etc",
      "A".repeat(43),
      "%00".repeat(10),
    ]) {
      const r = await view(t);
      expect([r.status, (await r.json()).error]).toEqual([404, "not_found"]);
      expect((await image(t, "coat")).status).toBe(404);
      expect((await vote(t, "coat")).status).toBe(404);
    }
  });
});

describe("votes", () => {
  it("20 concurrent votes from distinct voters all count", async () => {
    const a = await person();
    const { token } = await ask(a, await makeList(a, ["coat", "slip"]), [
      "coat",
      "slip",
    ]);
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        vote(token, i % 4 === 0 ? "slip" : "coat"),
      ),
    );
    expect(results.map((r) => r.status)).toEqual(Array(20).fill(200));
    expect(new Set(results.map(cookieOf)).size).toBe(20);
    const [mine] = await myAsks(a);
    expect(mine!.counts).toEqual({ coat: 15, slip: 5 });
    expect(mine!.total).toBe(20);
    expect(
      (
        await firestore()
          .collection("asks")
          .doc(mine!.askId)
          .collection("votes")
          .get()
      ).size,
    ).toBe(20);
  });

  it("a voter has one vote: repeating it changes nothing, changing it moves the count", async () => {
    const a = await person();
    const { token } = await ask(a, await makeList(a, ["coat", "slip"]), [
      "coat",
      "slip",
    ]);
    const first = await vote(token, "coat");
    const key = cookieOf(first)!;
    const cookie = `trailroom_voter=${key}`;
    expect((await first.json()).counts).toEqual({ coat: 1, slip: 0 });
    expect(
      (await (await vote(token, "coat", { cookie })).json()).counts,
    ).toEqual({ coat: 1, slip: 0 });
    expect(
      (await (await vote(token, "slip", { cookie })).json()).counts,
    ).toEqual({ coat: 0, slip: 1 });
    expect(
      (await (await vote(token, "coat", { cookie })).json()).counts,
    ).toEqual({ coat: 1, slip: 0 });
    const [mine] = await myAsks(a);
    expect(mine!.counts).toEqual({ coat: 1, slip: 0 });
    // Reload: the same cookie sees its vote and the split.
    const again = await (await view(token, { cookie })).json();
    expect([again.myVote, again.counts]).toEqual([
      "coat",
      { coat: 1, slip: 0 },
    ]);
    // A returning voter is not issued a new cookie.
    expect(cookieOf(await vote(token, "slip", { cookie }))).toBeUndefined();
  });

  it("the cookie is HttpOnly, SameSite=Lax, scoped, and Secure only in production", async () => {
    const a = await person();
    const { token } = await ask(a, await makeList(a, ["coat"]), ["coat"]);
    const set = (await vote(token, "coat")).headers.get("set-cookie")!;
    expect(set).toMatch(/HttpOnly/);
    expect(set).toMatch(/SameSite=Lax/);
    expect(set).toMatch(/Path=\/api\/ask(;|$)/);
    expect(set).not.toMatch(/Secure/);
    const { voteOnAsk } = await import("./ask-public");
    const prod = await voteOnAsk(
      token,
      req("POST", "/x", { json: { itemId: "coat" }, headers: fresh() }),
      true,
    );
    expect(prod.setCookie).toMatch(/Secure/);
  });

  it("the asker cannot vote on their own ask; a forged cookie shape is ignored", async () => {
    const a = await person();
    const { token } = await ask(a, await makeList(a, ["coat"]), ["coat"]);
    const own = await vote(token, "coat", { bearer: a.token });
    expect([own.status, (await own.json()).error]).toEqual([403, "own_ask"]);
    const v = await (await view(token, { bearer: a.token })).json();
    expect([v.isAsker, v.counts]).toEqual([true, { coat: 0 }]);
    // A cookie that is not the shape we issue (e.g. someone's uid) starts a new voter.
    const r = await vote(token, "coat", { cookie: `trailroom_voter=${a.uid}` });
    expect(r.status).toBe(200);
    expect(cookieOf(r)).toBeDefined();
  });

  it("rejects pieces outside the ask, bad bodies, oversize bodies, and floods", async () => {
    const a = await person();
    const { token } = await ask(a, await makeList(a, ["coat", "slip"]), [
      "coat",
    ]);
    for (const bad of ["slip", 4, null, undefined, { x: 1 }]) {
      expect((await vote(token, bad)).status, JSON.stringify(bad)).toBe(400);
    }
    const junk = await votePOST(
      req("POST", `/api/ask/${token}/vote`, {
        body: "not json",
        headers: { ...fresh(), "content-type": "application/json" },
      }),
      p({ token }),
    );
    expect(junk.status).toBe(400);
    const big = await votePOST(
      req("POST", `/api/ask/${token}/vote`, {
        body: JSON.stringify({ itemId: "coat", pad: "x".repeat(2000) }),
        headers: { ...fresh(), "content-type": "application/json" },
      }),
      p({ token }),
    );
    expect([big.status, (await big.json()).error]).toEqual([
      413,
      "body_too_large",
    ]);
    const same = fresh();
    const statuses: number[] = [];
    for (let i = 0; i < 32; i++)
      statuses.push((await vote(token, "coat", { headers: same })).status);
    expect(statuses.slice(0, 30)).toEqual(Array(30).fill(200));
    expect(statuses.slice(30)).toEqual([429, 429]);
    // Another network is not blocked.
    expect((await vote(token, "coat")).status).toBe(200);
  });
});

describe("the image route", () => {
  it("serves the asker's Front render for a frozen, finished pose set, capped at 1200px", async () => {
    const a = await withPhoto();
    const { poseSetId } = await tryOn(a.token, "blouse");
    const { token } = await ask(a, await makeList(a, ["blouse", "coat"]), [
      "blouse",
      "coat",
    ]);
    const res = await image(token, "blouse");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    for (const [k, v] of Object.entries(PUBLIC_ASK_HEADERS))
      expect(res.headers.get(k)).toBe(v);
    const got = await bytes(res);
    const meta = await sharp(got).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1200);
    const front = await getRender(a.uid, poseSetId, "front");
    const expected = await sharp(front!.data)
      .rotate()
      .resize({
        width: 1200,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 82 })
      .toBuffer();
    expect(got.equals(expected)).toBe(true);
    // The other piece is the label's photograph.
    expect(
      (await bytes(await image(token, "coat"))).equals(
        await labelBytes("coat"),
      ),
    ).toBe(true);
    // No query can ask for another pose.
    expect(
      (
        await bytes(await image(token, "blouse", "?pose=walking&size=tile"))
      ).equals(expected),
    ).toBe(true);
  });

  it("falls back to the label's photo when the pose set is deleted, failed, replaced or not theirs", async () => {
    const a = await withPhoto();
    const b = await withPhoto();
    const mine = await tryOn(a.token, "blouse");
    const theirs = await tryOn(b.token, "blouse");
    const label = await labelBytes("blouse");
    const listId = await makeList(a, ["blouse"]);

    // Deleted.
    const one = await ask(a, listId, ["blouse"]);
    expect((await bytes(await image(one.token, "blouse"))).equals(label)).toBe(
      false,
    );
    await deletePoseSet(mine.poseSetId);
    expect((await bytes(await image(one.token, "blouse"))).equals(label)).toBe(
      true,
    );
    expect((await (await view(one.token)).json()).pieces[0].rendered).toBe(
      false,
    );

    // Failed, and not complete.
    const two = await withPhoto();
    const twoSet = await tryOn(two.token, "blouse");
    const tl = await makeList(two, ["blouse"]);
    const t = await ask(two, tl, ["blouse"]);
    for (const status of ["failed", "rendering"] as const) {
      await updatePoseSet(twoSet.poseSetId, { status });
      expect((await bytes(await image(t.token, "blouse"))).equals(label)).toBe(
        true,
      );
    }
    await updatePoseSet(twoSet.poseSetId, { status: "complete" });
    expect((await bytes(await image(t.token, "blouse"))).equals(label)).toBe(
      false,
    );

    // A pose set that is not the asker's, planted in an ask, is never served.
    const forged = await createAskFor({
      uid: a.uid,
      askerFirstName: "Maya",
      listId,
      listName: "x",
      question: null,
      itemIds: ["blouse"],
      poseSetIds: { blouse: theirs.poseSetId },
    });
    if (!forged.ok) throw new Error("setup");
    expect(
      (await bytes(await image(forged.token, "blouse"))).equals(label),
    ).toBe(true);
    expect((await (await view(forged.token)).json()).pieces[0].rendered).toBe(
      false,
    );
  });

  it("falls back when the photo the render came from is removed", async () => {
    const a = await withPhoto();
    await tryOn(a.token, "blouse");
    const { token } = await ask(a, await makeList(a, ["blouse"]), ["blouse"]);
    expect((await (await view(token)).json()).pieces[0].rendered).toBe(true);
    const [photo] = await listPhotos(a.uid);
    await photoDELETE(
      req("DELETE", `/api/photos/${photo!.id}`, { token: a.token }),
      p({ photoId: photo!.id }),
    );
    expect((await (await view(token)).json()).pieces[0].rendered).toBe(false);
    expect(
      (await bytes(await image(token, "blouse"))).equals(
        await labelBytes("blouse"),
      ),
    ).toBe(true);
  });

  it("serves nothing outside the ask: other pieces, other paths, other prefixes", async () => {
    const a = await withPhoto();
    await tryOn(a.token, "blouse");
    const { token } = await ask(a, await makeList(a, ["blouse", "coat"]), [
      "blouse",
    ]);
    for (const itemId of [
      "coat",
      "slip",
      "photo",
      "staging",
      "front",
      "..",
      "%2e%2e",
      "blouse%2F..%2Fphotos",
      "catalog",
      "",
    ]) {
      const r = await image(token, itemId);
      expect([itemId, r.status]).toEqual([itemId, 404]);
    }
  });

  it("expired and revoked links serve no image and no data, on the very next request", async () => {
    const a = await withPhoto();
    await tryOn(a.token, "blouse");
    const listId = await makeList(a, ["blouse"]);
    const live = await ask(a, listId, ["blouse"]);
    expect((await image(live.token, "blouse")).status).toBe(200);
    await revokePOST(
      req("POST", `/api/asks/${live.body.askId}/revoke`, { token: a.token }),
      p({ id: live.body.askId }),
    );
    expect((await image(live.token, "blouse")).status).toBe(404);
    for (const r of [
      await view(live.token),
      await vote(live.token, "blouse"),
    ]) {
      expect(r.status).toBe(410);
    }
    expect((await myAsks(a))[0]!.state).toBe("revoked");

    const old = await createAskFor(
      {
        uid: a.uid,
        askerFirstName: "Maya",
        listId,
        listName: "x",
        question: null,
        itemIds: ["blouse"],
        poseSetIds: { blouse: null },
      },
      new Date(Date.now() - 8 * 24 * 3600 * 1000),
    );
    if (!old.ok) throw new Error("setup");
    expect((await image(old.token, "blouse")).status).toBe(404);
    for (const r of [await view(old.token), await vote(old.token, "blouse")]) {
      expect(r.status).toBe(410);
    }
    const gone = await (await image(old.token, "blouse")).text();
    expect(gone).not.toContain("JFIF");
  });
});

describe("no voter identity, no asker uid, in any response", () => {
  it("scans every body the asks, inbox and public routes return", async () => {
    const a = await withPhoto();
    const b = await person();
    const c = await person();
    await tryOn(a.token, "blouse");
    const listId = await makeList(a, ["blouse", "coat"]);
    const { token, body } = await ask(a, listId, ["blouse", "coat"], "Which?");
    const bodies: string[] = [JSON.stringify(body)];
    const keep = async (r: Response) => bodies.push(await r.clone().text());

    const anon = await vote(token, "blouse");
    const anonKey = cookieOf(anon)!;
    await keep(anon);
    await keep(await vote(token, "coat", { bearer: b.token }));
    await keep(await view(token, { bearer: c.token }));
    await keep(await view(token, { cookie: `trailroom_voter=${anonKey}` }));
    await keep(await view(token, { bearer: a.token }));
    await keep(await asksGET(req("GET", "/api/asks", { token: a.token })));
    await keep(await inboxGET(req("GET", "/api/inbox", { token: b.token })));
    await keep(await inboxGET(req("GET", "/api/inbox", { token: c.token })));
    await keep(
      await inboxDetailGET(
        req("GET", `/api/inbox/${body.askId}`, { token: c.token }),
        p({ askId: body.askId }),
      ),
    );

    const all = bodies.join("\n");
    for (const secret of [
      a.uid,
      b.uid,
      c.uid,
      anonKey,
      sha(token),
      "tokenHash",
      "voterUid",
      "voterKey",
    ]) {
      expect(all, secret).not.toContain(secret);
    }
    // Votes were counted, yet the asker sees only counts.
    expect((await myAsks(a))[0]!.counts).toEqual({ blouse: 1, coat: 1 });
  });
});

describe("the asks inbox", () => {
  it("a signed-in opener gets the ask, unread; voting from the inbox counts; closed when revoked", async () => {
    const a = await withPhoto();
    const b = await person();
    await tryOn(a.token, "blouse");
    const { token, body } = await ask(
      a,
      await makeList(a, ["blouse", "coat"]),
      ["blouse", "coat"],
      "Which one for Saturday?",
    );
    const inbox = async () =>
      await (
        await inboxGET(req("GET", "/api/inbox", { token: b.token }))
      ).json();
    expect(await inbox()).toEqual({ asks: [], unread: 0 });

    await view(token, { bearer: b.token });
    let box = await inbox();
    expect(box.unread).toBe(1);
    expect(box.asks[0]).toMatchObject({
      askId: body.askId,
      askerFirstName: "A friend",
      question: "Which one for Saturday?",
      itemIds: ["blouse", "coat"],
      votedItemId: null,
      unread: true,
      closed: false,
    });
    // Opening it again does not duplicate; the detail marks it read and shows the pieces.
    await view(token, { bearer: b.token });
    expect((await inbox()).asks).toHaveLength(1);
    const detail = await (
      await inboxDetailGET(
        req("GET", `/api/inbox/${body.askId}`, { token: b.token }),
        p({ askId: body.askId }),
      )
    ).json();
    expect(detail.pieces.map((x: { itemId: string }) => x.itemId)).toEqual([
      "blouse",
      "coat",
    ]);
    expect((await inbox()).unread).toBe(0);
    const img = await inboxImageGET(
      req("GET", `/api/inbox/${body.askId}/image/blouse`, { token: b.token }),
      p({ askId: body.askId, itemId: "blouse" }),
    );
    expect(img.status).toBe(200);

    const v = await inboxVotePOST(
      req("POST", `/api/inbox/${body.askId}/vote`, {
        token: b.token,
        json: { itemId: "coat" },
      }),
      p({ askId: body.askId }),
    );
    expect((await v.json()).myVote).toBe("coat");
    box = await inbox();
    expect(box.asks[0].votedItemId).toBe("coat");
    expect((await myAsks(a))[0]!.counts).toEqual({ blouse: 0, coat: 1 });
    // The public page, opened later by the same account, knows the vote.
    expect((await (await view(token, { bearer: b.token })).json()).myVote).toBe(
      "coat",
    );

    // Someone who never opened the link cannot reach it by id.
    const c = await person();
    for (const r of [
      await inboxDetailGET(
        req("GET", `/api/inbox/${body.askId}`, { token: c.token }),
        p({ askId: body.askId }),
      ),
      await inboxImageGET(
        req("GET", `/api/inbox/${body.askId}/image/blouse`, { token: c.token }),
        p({ askId: body.askId, itemId: "blouse" }),
      ),
      await inboxVotePOST(
        req("POST", `/api/inbox/${body.askId}/vote`, {
          token: c.token,
          json: { itemId: "coat" },
        }),
        p({ askId: body.askId }),
      ),
    ]) {
      expect(r.status).toBe(404);
    }

    await revokePOST(
      req("POST", `/api/asks/${body.askId}/revoke`, { token: a.token }),
      p({ id: body.askId }),
    );
    box = await inbox();
    expect(box.asks[0]).toMatchObject({ closed: true, unread: false });
    const closed = await (
      await inboxDetailGET(
        req("GET", `/api/inbox/${body.askId}`, { token: b.token }),
        p({ askId: body.askId }),
      )
    ).json();
    expect(closed).toEqual({
      closed: true,
      askerFirstName: "A friend",
      question: "Which one for Saturday?",
    });
    expect(
      (
        await inboxImageGET(
          req("GET", `/api/inbox/${body.askId}/image/blouse`, {
            token: b.token,
          }),
          p({ askId: body.askId, itemId: "blouse" }),
        )
      ).status,
    ).toBe(404);
  });
});

describe("housekeeping", () => {
  it("deleting a list revokes the live asks made from it", async () => {
    const a = await person();
    const listId = await makeList(a, ["coat"]);
    const { token } = await ask(a, listId, ["coat"]);
    expect(
      (
        await listDELETE(
          req("DELETE", `/api/lists/${listId}`, { token: a.token }),
          p({ id: listId }),
        )
      ).status,
    ).toBe(200);
    expect((await view(token)).status).toBe(410);
    expect((await myAsks(a))[0]!.state).toBe("revoked");
  });

  it("the purge deletes asks 30 days after expiry, with their votes, and leaves the rest", async () => {
    const a = await person();
    const listId = await makeList(a, ["coat"]);
    const base = {
      uid: a.uid,
      askerFirstName: "Maya",
      listId,
      listName: "x",
      question: null,
      itemIds: ["coat"],
      poseSetIds: { coat: null },
    };
    const day = 24 * 3600 * 1000;
    const mk = async (createdDaysAgo: number) => {
      const r = await createAskFor(
        base,
        new Date(Date.now() - createdDaysAgo * day),
      );
      if (!r.ok) throw new Error("setup");
      return r;
    };
    const old = await mk(7 + 31); // expired 31 days ago
    const recent = await mk(7 + 10); // expired 10 days ago
    const liveOne = await mk(0);
    await firestore()
      .collection("asks")
      .doc(old.id)
      .collection("votes")
      .doc("v1")
      .set({ itemId: "coat", voterUid: null, createdAt: new Date() });
    expect(ASK_RETENTION_MS).toBe(30 * day);
    const result = await purgeExpiredGuests();
    expect(result.asksDeleted).toBe(1);
    const left = (await firestore().collection("asks").get()).docs
      .map((d) => d.id)
      .sort();
    expect(left).toEqual([recent.id, liveOne.id].sort());
    expect(
      (
        await firestore()
          .collection("asks")
          .doc(old.id)
          .collection("votes")
          .get()
      ).size,
    ).toBe(0);
  });

  it("Delete everything removes lists, asks with their votes and the inbox, and anonymises votes elsewhere", async () => {
    const a = await withPhoto();
    const b = await withPhoto();
    const listA = await makeList(a, ["coat", "slip"]);
    const askA = await ask(a, listA, ["coat", "slip"]);
    const listB = await makeList(b, ["coat"]);
    const askB = await ask(b, listB, ["coat"]);

    // b votes on a's ask (signed in, so under their uid) and has a's ask in their inbox.
    await vote(askA.token, "slip", { bearer: b.token });
    // a votes on b's ask, and an anonymous voter votes on a's.
    await vote(askB.token, "coat", { bearer: a.token });
    await vote(askA.token, "coat");
    expect((await myAsks(a))[0]!.counts).toEqual({ coat: 1, slip: 1 });

    // b deletes everything: a's ask keeps the count, but the vote no longer points at b.
    expect(
      (await accountDELETE(req("DELETE", "/api/photo", { token: b.token })))
        .status,
    ).toBe(200);
    expect((await myAsks(a))[0]!.counts).toEqual({ coat: 1, slip: 1 });
    const votesA = (
      await firestore()
        .collection("asks")
        .doc(askA.body.askId)
        .collection("votes")
        .get()
    ).docs;
    expect(votesA).toHaveLength(2);
    expect(
      votesA.some((d) => d.id === b.uid || d.get("voterUid") === b.uid),
    ).toBe(false);
    expect(votesA.map((d) => d.get("itemId")).sort()).toEqual(["coat", "slip"]);
    expect(
      (await firestore().collection("asks").doc(askB.body.askId).get()).exists,
    ).toBe(false);
    expect(
      (await firestore().collection("lists").doc(listB).get()).exists,
    ).toBe(false);
    expect(
      (
        await firestore()
          .collection("inbox")
          .doc(b.uid)
          .collection("asks")
          .get()
      ).size,
    ).toBe(0);
    expect((await view(askB.token)).status).toBe(404);

    // a deletes everything: their lists, asks, votes and inbox go; their vote on b's ask is gone with it.
    expect(
      (await accountDELETE(req("DELETE", "/api/photo", { token: a.token })))
        .status,
    ).toBe(200);
    for (const c of ["lists", "asks"]) expect(await dump(c)).toEqual([]);
    expect((await firestore().collectionGroup("votes").get()).size).toBe(0);
    expect(
      (
        await firestore()
          .collection("inbox")
          .doc(a.uid)
          .collection("asks")
          .get()
      ).size,
    ).toBe(0);
    expect((await view(askA.token)).status).toBe(404);
  });
});

describe("the public routes do bounded work", () => {
  const voteReq = (token: string, init: RequestInit & { headers: object }) =>
    votePOST(
      new Request(`http://localhost/api/ask/${token}/vote`, {
        method: "POST",
        ...init,
        // @ts-expect-error duplex is needed for a streamed body
        duplex: "half",
      }),
      p({ token }),
    );
  const json = { "content-type": "application/json" };

  it("reads the vote body with a hard byte cap, without buffering the rest", async () => {
    const a = await person();
    const { token } = await ask(a, await makeList(a, ["coat"]), ["coat"]);
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(c) {
        pulled++;
        c.enqueue(new Uint8Array(100));
        if (pulled > 1000) c.close();
      },
    });
    const res = await voteReq(token, {
      body,
      headers: { ...json, ...fresh() },
    });
    expect([res.status, (await res.json()).error]).toEqual([
      413,
      "body_too_large",
    ]);
    expect(pulled).toBeLessThan(20);
  });

  it("only takes JSON, and never from another site's page", async () => {
    const a = await person();
    const { token } = await ask(a, await makeList(a, ["coat"]), ["coat"]);
    const send = (headers: Record<string, string>) =>
      voteReq(token, {
        body: JSON.stringify({ itemId: "coat" }),
        headers: { ...fresh(), ...headers },
      });
    expect((await send({ "content-type": "text/plain" })).status).toBe(400);
    expect((await send({})).status).toBe(400);
    expect(
      (await send({ ...json, "sec-fetch-site": "cross-site" })).status,
    ).toBe(400);
    expect(
      (await send({ ...json, "sec-fetch-site": "same-origin" })).status,
    ).toBe(200);
    expect((await send(json)).status).toBe(200);
    expect((await myAsks(a))[0]!.total).toBe(2);
  });

  it("limits public reads per client and token, and probing for tokens that do not exist", async () => {
    const a = await person();
    const { token } = await ask(a, await makeList(a, ["coat"]), ["coat"]);
    const get = (client: string, t = token) =>
      askGET(
        req("GET", `/api/ask/${t}`, { headers: { "x-forwarded-for": client } }),
        p({ token: t }),
      );
    const statuses: number[] = [];
    for (let i = 0; i < 241; i++)
      statuses.push((await get("10.77.0.1")).status);
    expect(statuses.slice(0, 240).every((x) => x === 200)).toBe(true);
    const over = await get("10.77.0.1");
    expect([over.status, (await over.json()).error]).toEqual([
      429,
      "too_many_attempts",
    ]);
    expect((await get("10.77.0.2")).status).toBe(200);

    const misses: number[] = [];
    for (let i = 0; i < 31; i++)
      misses.push((await get("10.77.0.3", newAskToken().token)).status);
    expect(misses.slice(0, 30).every((x) => x === 404)).toBe(true);
    expect(misses[30]).toBe(429);
    expect((await get("10.77.0.3")).status).toBe(429);
  });
});

describe("served images and frozen renders", () => {
  it("checks liveness on every request, even when the bytes are cached", async () => {
    const a = await withPhoto();
    await tryOn(a.token, "blouse");
    const { token, body } = await ask(a, await makeList(a, ["blouse"]), [
      "blouse",
    ]);
    const first = await image(token, "blouse");
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("private, no-store");
    const again = await image(token, "blouse");
    expect((await bytes(again)).equals(await bytes(first))).toBe(true);
    await revokePOST(
      req("POST", `/api/asks/${body.askId}/revoke`, { token: a.token }),
      p({ id: body.askId }),
    );
    expect((await image(token, "blouse")).status).toBe(404);
  });

  it("a removed try-on re-rendered on the same photo does not reappear on the old link", async () => {
    const a = await withPhoto();
    const first = await tryOn(a.token, "blouse");
    const { token } = await ask(a, await makeList(a, ["blouse"]), ["blouse"]);
    const label = await labelBytes("blouse");
    const rendered = await bytes(await image(token, "blouse"));
    expect(rendered.equals(label)).toBe(false);

    await deletePoseSet(first.poseSetId);
    expect((await bytes(await image(token, "blouse"))).equals(label)).toBe(
      true,
    );
    const second = await tryOn(a.token, "blouse");
    expect(second.poseSetId).toBe(first.poseSetId);
    expect(second.jobId).not.toBe(first.jobId);
    expect((await bytes(await image(token, "blouse"))).equals(label)).toBe(
      true,
    );
    expect((await (await view(token)).json()).pieces[0].rendered).toBe(false);
    // A new ask freezes the new render.
    const fresh2 = await ask(a, await makeList(a, ["blouse"], "Again"), [
      "blouse",
    ]);
    expect((await (await view(fresh2.token)).json()).pieces[0].rendered).toBe(
      true,
    );
  });

  it("an ask made before the job id was frozen shows the label photograph", async () => {
    const a = await withPhoto();
    const { poseSetId } = await tryOn(a.token, "blouse");
    const made = await createAskFor({
      uid: a.uid,
      askerFirstName: "Maya",
      listId: "x",
      listName: "x",
      question: null,
      itemIds: ["blouse"],
      poseSetIds: { blouse: poseSetId },
    });
    if (!made.ok) throw new Error("setup");
    expect((await (await view(made.token)).json()).pieces[0].rendered).toBe(
      false,
    );
  });
});

describe("vote cap, openers and the public view", () => {
  it("holds at most 500 vote documents per ask; changing a vote does not count again", async () => {
    const a = await person();
    const { token, body } = await ask(a, await makeList(a, ["coat", "slip"]), [
      "coat",
      "slip",
    ]);
    const first = await vote(token, "coat");
    const cookie = `trailroom_voter=${cookieOf(first)}`;
    const doc = () => firestore().collection("asks").doc(body.askId);
    expect((await doc().get()).get("voteCount")).toBe(1);
    await doc().update({ voteCount: 500 });
    const full = await vote(token, "slip");
    expect([full.status, (await full.json()).error]).toEqual([409, "ask_full"]);
    const moved = await vote(token, "slip", { cookie });
    expect(moved.status).toBe(200);
    expect((await doc().get()).get("voteCount")).toBe(500);
    expect((await myAsks(a))[0]!.counts).toEqual({ coat: 0, slip: 1 });
    // Directly, too.
    const r = await castVote(body.askId, "f".repeat(32), null, "coat");
    expect(r).toEqual({ ok: false, error: "full" });
  });

  it("never puts the private fields in a view", async () => {
    const a = await withPhoto();
    const b = await person();
    await tryOn(a.token, "blouse");
    const { token, body } = await ask(a, await makeList(a, ["blouse"]), [
      "blouse",
    ]);
    const res = await view(token, { bearer: b.token });
    const text = JSON.stringify(await res.json());
    for (const field of ["openedBy", "voteCount", "poseSetJobIds", "tokenHash"])
      expect(text).not.toContain(field);
    expect(text).not.toContain(b.uid);
    expect(text).not.toContain(a.uid);
    const doc = (
      await firestore().collection("asks").doc(body.askId).get()
    ).data()!;
    expect(doc.openedBy).toEqual([b.uid]);
  });

  it("Delete everything clears the ask from friends' inboxes; a revoked ask stays, closed", async () => {
    const a = await withPhoto();
    const b = await person();
    const c = await person();
    const list = await makeList(a, ["coat", "slip"]);
    const live = await ask(a, list, ["coat"], "Which one for Saturday?");
    const other = await ask(a, list, ["slip"], "And this?");
    await view(live.token, { bearer: b.token });
    await view(other.token, { bearer: c.token });
    await revokePOST(
      req("POST", `/api/asks/${other.body.askId}/revoke`, { token: a.token }),
      p({ id: other.body.askId }),
    );
    const inbox = async (t: Person) =>
      (
        await (
          await inboxGET(req("GET", "/api/inbox", { token: t.token }))
        ).json()
      ).asks as { askId: string; closed: boolean }[];
    expect(await inbox(b)).toHaveLength(1);
    expect((await inbox(c))[0]).toMatchObject({ closed: true });

    expect(
      (await accountDELETE(req("DELETE", "/api/photo", { token: a.token })))
        .status,
    ).toBe(200);
    for (const t of [b, c])
      expect(
        (
          await firestore()
            .collection("inbox")
            .doc(t.uid)
            .collection("asks")
            .get()
        ).size,
      ).toBe(0);
    expect(await inbox(b)).toEqual([]);
  });

  it("getInbox drops and deletes an entry whose ask no longer exists", async () => {
    const b = await person();
    const ref = firestore()
      .collection("inbox")
      .doc(b.uid)
      .collection("asks")
      .doc("gone-ask");
    await ref.set({
      askerFirstName: "Maya",
      question: "Which?",
      itemIds: ["coat"],
      firstOpenedAt: new Date(),
      votedItemId: null,
      unread: true,
    });
    const box = await (
      await inboxGET(req("GET", "/api/inbox", { token: b.token }))
    ).json();
    expect(box).toEqual({ asks: [], unread: 0 });
    expect((await ref.get()).exists).toBe(false);
  });
});

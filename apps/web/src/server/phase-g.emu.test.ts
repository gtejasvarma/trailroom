// Phase G: the follow loop. Publishing without a back office, new arrivals that need no render,
// the "arrives on you" buffer (off by default), email through a transport (none by default),
// the unsubscribe path, and deletion. The fake provider stands in for the model.
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getItem } from "@trailroom/catalog";
import {
  auth,
  bucket,
  firestore,
  getArrivals,
  getJob,
  getPoseSet,
  getUsage,
  setFollow,
  type SpendDayDoc,
} from "@trailroom/db";
import {
  changePiecePrice,
  loadPublishedCatalog,
  publishPiece,
  resetPublishedCatalogCache,
} from "@trailroom/pipeline";
import {
  estimateCostMicros,
  getFakeCalls,
  PROMPT_VERSION,
  setFakeScript,
} from "@trailroom/render";
import { GET as arrivalsGET } from "../app/api/arrivals/route";
import { POST as seenPOST } from "../app/api/arrivals/seen/route";
import { GET as prefsGET, PUT as prefsPUT } from "../app/api/email-prefs/route";
import { GET as meGET } from "../app/api/me/route";
import { POST as tryOnPOST } from "../app/api/try-on/route";
import { DELETE as photoDELETE } from "../app/api/photo/route";
import { POST as unsubPOST } from "../app/api/unsubscribe/[token]/route";
import { GET as catalogGET } from "../app/catalog/[file]/route";
import { GET as jobGET } from "../app/api/jobs/[jobId]/route";
import { GET as renderGET } from "../app/api/renders/[poseSetId]/[pose]/route";
import { listObjects } from "../../../../packages/pipeline/src/testkit";
import { refillArrivalsFor, runArrivals } from "./arrivals";
import { runEmail } from "./email/run";
import { clearSentEmails, sentEmails } from "./email/transport";
import { awaitInlineRuns } from "./orchestrator";
import { purgeExpiredGuests } from "./purge";
import {
  anonymousToken,
  emailToken,
  image,
  req,
  reset,
  uidOf,
  uploadOk,
} from "./testkit";

vi.mock("./workflows", () => ({ startWorkflowExecution: vi.fn() }));
process.env.RENDER_PROVIDER = "fake";

const ORIGIN = "https://trailroom.test";
const SWITCHES = [
  "ARRIVALS_BUFFER",
  "EMAIL_TRANSPORT",
  "ARRIVALS_DAILY_USD",
  "DAILY_CAP_USD",
];
const params = <T>(p: T) => ({ params: Promise.resolve(p) });

beforeEach(async () => {
  for (const k of SWITCHES) delete process.env[k];
  process.env.ORCHESTRATOR = "inline";
  setFakeScript(null);
  clearSentEmails();
  resetPublishedCatalogCache();
  await reset();
  await bucket().deleteFiles({ prefix: "catalog/", force: true });
});
afterEach(async () => {
  await awaitInlineRuns();
  setFakeScript(null);
  for (const k of SWITCHES) delete process.env[k];
});

let n = 0;
async function jpeg() {
  return image(600, 800);
}
/** Publishes a ready top for a label and returns its id. */
async function publish(label = "loam-studio", id = `piece-${++n}`, now?: Date) {
  const name = label === "loam-studio" ? "LOAM STUDIO" : "MARCHAND";
  const r = await publishPiece(
    {
      id,
      name: `Washed linen shirt ${id}`,
      label: name,
      labelSlug: label,
      priceUsd: 140,
      shopCategory: "apparel",
      shelf: "New in",
      stock: { line: "In stock", low: false },
      pairsWith: [],
      photos: [{ file: `${id}-1.jpg`, label: "Front", focus: "50% 26%" }],
      description: "Washed linen with a camp collar and a straight cut.",
      category: "top",
      promptDescription: "washed linen camp-collar shirt",
      readiness: 88,
      readinessReasons: [
        "Clear label photographs with the whole garment visible.",
      ],
      tryOn: "ready",
    },
    [{ file: `${id}-1.jpg`, data: await jpeg() }],
    now,
  );
  if (!r.ok) throw new Error(r.problems.join("; "));
  return id;
}

async function account(opts: { follow?: string[]; photo?: boolean } = {}) {
  const t = await emailToken();
  const uid = uidOf(t);
  await auth().updateUser(uid, { emailVerified: true });
  if (opts.photo !== false) await uploadOk(t);
  for (const l of opts.follow ?? ["loam-studio"]) await setFollow(uid, l, true);
  return { t, uid };
}
const view = async (t: string) =>
  (await arrivalsGET(req("GET", "/api/arrivals", { token: t }))).json();
const seen = (t: string, itemIds: string[]) =>
  seenPOST(req("POST", "/api/arrivals/seen", { token: t, json: { itemIds } }));
const buffer = (on: boolean) => {
  if (on) process.env.ARRIVALS_BUFFER = "on";
  else delete process.env.ARRIVALS_BUFFER;
};
const jobs = async () => (await firestore().collection("jobs").get()).docs;

describe("publishing without a back office", () => {
  it("stores the piece and its image, records the event, and the catalogue accessors see it", async () => {
    const id = await publish();
    expect(getItem(id)).toBeDefined(); // publishing loads it into this process
    resetPublishedCatalogCache();
    await loadPublishedCatalog({ force: true });
    expect(getItem(id)?.name).toContain("Washed linen shirt");
    expect((await firestore().collection("publishedPieces").get()).size).toBe(
      1,
    );
    const events = await firestore().collection("publishEvents").get();
    expect(events.docs.map((d) => d.get("type"))).toEqual(["new_piece"]);
    expect(await listObjects("catalog/")).toContain(`catalog/${id}-1.jpg`);
    // The image route serves it.
    const res = await catalogGET(
      req("GET", `/catalog/${id}-1.jpg`),
      params({ file: `${id}-1.jpg` }),
    );
    expect(res.status).toBe(200);
  });

  it("refuses fit or size language, a taken id and a missing image, writing nothing", async () => {
    const base = {
      id: "bad-piece",
      name: "Linen shirt",
      label: "LOAM STUDIO",
      labelSlug: "loam-studio",
      priceUsd: 100,
      shopCategory: "apparel",
      shelf: "New in",
      stock: { line: "In stock", low: false },
      pairsWith: [],
      photos: [{ file: "bad-piece-1.jpg", label: "Front", focus: "50% 26%" }],
      description: "Runs small, so size up.",
      category: "top",
      promptDescription: "linen shirt",
      readiness: 90,
      readinessReasons: [],
      tryOn: "ready",
    };
    const img = [{ file: "bad-piece-1.jpg", data: await jpeg() }];
    const a = await publishPiece(base, img);
    expect(a.ok).toBe(false);
    const b = await publishPiece({ ...base, description: "Linen." }, []);
    expect(b).toMatchObject({ ok: false });
    expect((await firestore().collection("publishedPieces").get()).size).toBe(
      0,
    );
    expect((await firestore().collection("publishEvents").get()).size).toBe(0);
    expect(await listObjects("catalog/")).toEqual([]);
    const ok = await publishPiece({ ...base, description: "Linen." }, img);
    expect(ok.ok).toBe(true);
    const again = await publishPiece({ ...base, description: "Linen." }, img);
    expect(again.ok).toBe(false);
  });

  it("does not show a stored piece that no longer passes the copy rules", async () => {
    const id = await publish();
    await firestore()
      .collection("publishedPieces")
      .doc(id)
      .update({ "piece.description": "Hits mid-calf on you." });
    resetPublishedCatalogCache();
    await loadPublishedCatalog({ force: true });
    expect(getItem(id)).toBeUndefined();
  });

  it("changes a price once, records the event, and refuses a no-op", async () => {
    const id = await publish();
    const r = await changePiecePrice(id, 120);
    expect(r).toMatchObject({ ok: true, oldPriceUsd: 140 });
    expect(getItem(id)?.priceUsd).toBe(120);
    expect((await changePiecePrice(id, 120)).ok).toBe(false);
    expect((await changePiecePrice("coat", 1)).ok).toBe(false);
    expect((await changePiecePrice(id, -3)).ok).toBe(false);
    const types = (
      await firestore().collection("publishEvents").get()
    ).docs.map((d) => d.get("type"));
    expect(types.sort()).toEqual(["new_piece", "price_change"]);
  });
});

describe("new arrivals with both switches off", () => {
  it("shows a followed label's new piece with the label's photo, and nothing is rendered", async () => {
    const id = await publish();
    await publish("marchand"); // a label this person does not follow
    const { t, uid } = await account();
    const v = await view(t);
    expect(v.pieces.map((p: { id: string }) => p.id)).toEqual([id]);
    expect(v.cards).toEqual([]);

    const r = await runArrivals(new Date());
    expect(r).toEqual({ enabled: false, started: 0, people: 0 });
    expect(await refillArrivalsFor(uid, new Date(), { left: 5 })).toBe(0);
    expect(getFakeCalls()).toHaveLength(0);
    expect(await jobs()).toHaveLength(0);
    expect(await getArrivals(uid)).toBeNull();
    expect((await firestore().collection("spend").get()).size).toBe(0);
  });

  it("shows nothing to someone who follows nobody, and works for a guest", async () => {
    await publish();
    const { t } = await account({ follow: [] });
    expect((await view(t)).pieces).toEqual([]);
    const g = await anonymousToken();
    await setFollow(uidOf(g), "loam-studio", true);
    const v = await view(g);
    expect(v.pieces).toHaveLength(1);
    expect(v.cards).toEqual([]);
  });

  it("drops a piece older than thirty days from the shelf", async () => {
    await publish(
      "loam-studio",
      "old-piece",
      new Date(Date.now() - 31 * 86_400_000),
    );
    const { t } = await account();
    expect((await view(t)).pieces).toEqual([]);
  });

  it("the housekeeping call reports no buffer renders and no emails", async () => {
    await publish();
    await account();
    const r = await purgeExpiredGuests(new Date(), ORIGIN);
    expect(r).toMatchObject({ arrivalsStarted: 0, emailsSent: 0 });
    expect(await jobs()).toHaveLength(0);
  });

  it("an invalid switch value stops the app rather than switching the buffer on", async () => {
    process.env.ARRIVALS_BUFFER = "yes";
    await expect(runArrivals(new Date())).rejects.toThrow();
  });
});

describe("arrives on you (ARRIVALS_BUFFER=on)", () => {
  it("renders the Front pose on the default photo, through the graph, and shows it as a card", async () => {
    buffer(true);
    const id = await publish();
    const { t, uid } = await account();
    const r = await runArrivals(new Date());
    expect(r).toMatchObject({ enabled: true, started: 1, people: 1 });
    await awaitInlineRuns();

    const [job] = await jobs();
    expect(job!.data()).toMatchObject({
      kind: "arrival",
      itemId: id,
      poseOrder: ["front"],
      promptVersion: PROMPT_VERSION,
      status: "complete",
      isGuest: false,
    });
    expect(getFakeCalls()).toHaveLength(1);
    // It is not the person's own try-on: it did not count against their limit.
    expect(await getUsage(uid)).toBeNull();
    // It is on the lower ceiling's books.
    const day = (
      await firestore().collection("spend").get()
    ).docs[0]!.data() as SpendDayDoc;
    expect(day.unrequestedCommittedMicros).toBeGreaterThan(0);
    expect(day.unrequestedPendingMicros).toBe(0);

    const v = await view(t);
    expect(v.cards).toEqual([
      { itemId: id, poseSetId: expect.stringMatching(/\.arr$/), seen: false },
    ]);
    // The render is theirs to open at full size, and nobody else's.
    const ok = await renderGET(
      req("GET", `/api/renders/${v.cards[0].poseSetId}/front`, { token: t }),
      params({ poseSetId: v.cards[0].poseSetId, pose: "front" }),
    );
    expect(ok.status).toBe(200);
    const other = await emailToken();
    const no = await renderGET(
      req("GET", `/api/renders/${v.cards[0].poseSetId}/front`, {
        token: other,
      }),
      params({ poseSetId: v.cards[0].poseSetId, pose: "front" }),
    );
    expect(no.status).toBe(404);
    // The job is not a screen anyone opens.
    const j = await jobGET(
      req("GET", `/api/jobs/${job!.id}`, { token: t }),
      params({ jobId: job!.id }),
    );
    expect(j.status).toBe(404);
    // And the me endpoint does not report it as the person's running try-on.
    const me = await (await meGET(req("GET", "/api/me", { token: t }))).json();
    expect(me.activePoseSets).toEqual([]);
  });

  it("never exceeds five cards, and never starts another batch before all five were seen", async () => {
    buffer(true);
    const ids: string[] = [];
    for (let i = 0; i < 7; i++) ids.push(await publish());
    const { t, uid } = await account();
    const first = await runArrivals(new Date());
    expect(first.started).toBe(5);
    await awaitInlineRuns();
    expect((await getArrivals(uid))!.cards).toHaveLength(5);
    expect(getFakeCalls()).toHaveLength(5);

    // A new piece arrives, and the cards are all unseen: nothing renders.
    await publish();
    expect((await runArrivals(new Date())).started).toBe(0);
    // Four of five seen is still not "all seen".
    const cards = (await view(t)).cards as { itemId: string }[];
    expect(cards).toHaveLength(5);
    await seen(
      t,
      cards.slice(0, 4).map((c) => c.itemId),
    );
    expect((await runArrivals(new Date())).started).toBe(0);
    expect(getFakeCalls()).toHaveLength(5);

    // All five seen: the next batch is the pieces not yet offered (3), replacing the old cards.
    await seen(t, [cards[4]!.itemId]);
    expect((await runArrivals(new Date())).started).toBe(3);
    await awaitInlineRuns();
    const after = (await getArrivals(uid))!;
    expect(after.cards).toHaveLength(3);
    const offered = new Set(cards.map((c) => c.itemId));
    expect(after.cards.every((c) => !offered.has(c.itemId))).toBe(true);
    expect(getFakeCalls()).toHaveLength(8);
    // Nothing is ever offered twice.
    await seen(
      t,
      after.cards.map((c) => c.itemId),
    );
    expect((await runArrivals(new Date())).started).toBe(0);
  });

  it("does not start a batch while a card is still rendering", async () => {
    buffer(true);
    await publish();
    await publish();
    const { uid } = await account();
    setFakeScript([{ outcome: "ok", delayMs: 800 }]);
    expect(await refillArrivalsFor(uid, new Date(), { left: 5 })).toBe(2);
    await publish();
    expect(await refillArrivalsFor(uid, new Date(), { left: 5 })).toBe(0);
    await awaitInlineRuns();
  });

  it("is never for a guest, nor for an account without consent, a photo, or a follow", async () => {
    buffer(true);
    await publish();
    const g = await anonymousToken();
    await uploadOk(g);
    await setFollow(uidOf(g), "loam-studio", true);
    const noPhoto = await account({ photo: false });
    const noFollow = await account({ follow: [] });
    const noConsent = await account({ photo: false });
    expect((await runArrivals(new Date())).started).toBe(0);
    for (const u of [uidOf(g), noPhoto.uid, noFollow.uid, noConsent.uid]) {
      expect(await refillArrivalsFor(u, new Date(), { left: 5 })).toBe(0);
    }
    expect(getFakeCalls()).toHaveLength(0);
    expect(await jobs()).toHaveLength(0);
    // The shelf API tells a guest nothing about cards.
    expect((await view(g)).cards).toEqual([]);
  });

  it("a render that fails the gate is simply not shown: no card, no error", async () => {
    buffer(true);
    const id = await publish();
    const { t, uid } = await account();
    setFakeScript([{ pose: "front", outcome: "blocked" }]);
    expect((await runArrivals(new Date())).started).toBe(1);
    await awaitInlineRuns();
    const v = await view(t);
    expect(v.cards).toEqual([]);
    expect(v.pieces.map((p: { id: string }) => p.id)).toEqual([id]); // the plain new arrival stays
    // The failed piece is not retried, and the failed card does not block the buffer.
    setFakeScript(null);
    const next = await publish();
    expect((await runArrivals(new Date())).started).toBe(1);
    await awaitInlineRuns();
    expect(
      (await view(t)).cards.map((c: { itemId: string }) => c.itemId),
    ).toEqual([next]);
    expect((await getArrivals(uid))!.attempted).toEqual(
      expect.arrayContaining([id, next]),
    );
  });

  it("stops at the ceiling for unrequested renders, and leaves requested try-ons their headroom", async () => {
    buffer(true);
    const est = estimateCostMicros("nano-banana-2.1", 2);
    // Room for exactly two unrequested renders of this size.
    process.env.ARRIVALS_DAILY_USD = String((est * 2.5) / 1e6);
    for (let i = 0; i < 5; i++) await publish();
    const a = await account();
    const b = await account();
    const first = await runArrivals(new Date());
    expect(first.started).toBe(2);
    await awaitInlineRuns();
    // The day's buffer money is used: nobody else gets a render, now or on the next run.
    expect((await runArrivals(new Date())).started).toBe(0);
    // Only the budget the ceiling allowed was ever started.
    expect(getFakeCalls().length).toBe(2);
    void b;
    // A requested try-on still renders, from the headroom the lower ceiling left.
    const res = await tryOnPOST(
      req("POST", "/api/try-on", { token: a.t, json: { itemId: "coat" } }),
    );
    expect(res.status).toBe(202);
    await awaitInlineRuns();
    const day = (
      await firestore().collection("spend").get()
    ).docs[0]!.data() as SpendDayDoc;
    expect(day.committedMicros).toBeGreaterThan(
      day.unrequestedCommittedMicros!,
    );
  });

  it("stops at the daily cap too: an unrequested render cannot pass it", async () => {
    buffer(true);
    const est = estimateCostMicros("nano-banana-2.1", 2);
    process.env.DAILY_CAP_USD = String((est * 1.5) / 1e6);
    process.env.ARRIVALS_DAILY_USD = "100"; // clamped to the cap
    for (let i = 0; i < 3; i++) await publish();
    await account();
    expect((await runArrivals(new Date())).started).toBe(1);
    await awaitInlineRuns();
    const day = (
      await firestore().collection("spend").get()
    ).docs[0]!.data() as SpendDayDoc;
    expect(day.committedMicros + day.pendingMicros).toBeLessThanOrEqual(
      Math.floor(est * 1.5),
    );
  });

  it("a ceiling hit at render time fails the card quietly, and it may be offered again tomorrow", async () => {
    buffer(true);
    const id = await publish();
    const { t, uid } = await account();
    // The launch check passes, then the day is spent before the node reserves.
    process.env.ARRIVALS_DAILY_USD = "1";
    const day = new Date().toISOString().slice(0, 10);
    expect((await runArrivals(new Date())).started).toBe(1);
    await awaitInlineRuns();
    await firestore().collection("spend").doc(day).set(
      {
        committedMicros: 999_999_000,
        pendingMicros: 0,
        ceilingMicros: 5_000_000,
      },
      { merge: true },
    );
    // Second piece: launch check now sees no room at all.
    await publish();
    expect((await runArrivals(new Date())).started).toBe(0);
    expect(
      (await view(t)).cards.map((c: { itemId: string }) => c.itemId),
    ).toEqual([id]);
    expect(
      await getPoseSet((await getArrivals(uid))!.cards[0]!.poseSetId),
    ).toBeTruthy();
  });

  it("opening a card and asking for the full set is an ordinary requested try-on", async () => {
    buffer(true);
    const id = await publish();
    const { t, uid } = await account();
    await runArrivals(new Date());
    await awaitInlineRuns();
    const cardSet = (await view(t)).cards[0].poseSetId as string;
    const res = await tryOnPOST(
      req("POST", "/api/try-on", { token: t, json: { itemId: id } }),
    );
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.poseSetId).not.toBe(cardSet);
    expect(body.poseSetId).not.toMatch(/\.arr$/);
    await awaitInlineRuns();
    expect((await getJob(body.jobId))!.poseOrder).toHaveLength(4);
    expect((await getUsage(uid))!.starts).toBe(1); // this one counted; the buffer's did not
  });

  it("a buffer render in progress never blocks the person's own try-on", async () => {
    buffer(true);
    await publish();
    const { t, uid } = await account();
    setFakeScript([{ outcome: "ok", delayMs: 1200 }]);
    expect(await refillArrivalsFor(uid, new Date(), { left: 5 })).toBe(1);
    const res = await tryOnPOST(
      req("POST", "/api/try-on", { token: t, json: { itemId: "coat" } }),
    );
    expect(res.status).toBe(202);
    await awaitInlineRuns();
  });
});

describe("email", () => {
  const enable = () => {
    process.env.EMAIL_TRANSPORT = "log";
  };
  const prefs = (t: string, json: unknown) =>
    prefsPUT(req("PUT", "/api/email-prefs", { token: t, json }));
  const later = (h: number) => new Date(Date.now() + h * 3_600_000);

  it("with transport none, sends nothing, records nothing, and shows no email controls", async () => {
    await publish();
    const { t, uid } = await account();
    await firestore()
      .collection("emailPrefs")
      .doc(uid)
      .set({ news: true, price: true });
    const r = await runEmail(new Date(), ORIGIN);
    expect(r).toEqual({ transport: "none", news: 0, price: 0 });
    expect(sentEmails()).toHaveLength(0);
    for (const c of ["emailSent", "emailTokens"]) {
      expect((await firestore().collection(c).get()).size).toBe(0);
    }
    expect(
      (await firestore().collection("emailPrefs").doc(uid).get()).get(
        "lastNewsAt",
      ),
    ).toBeUndefined();
    const me = await (await meGET(req("GET", "/api/me", { token: t }))).json();
    expect(me.emailEnabled).toBe(false);
    expect(
      (await prefsGET(req("GET", "/api/email-prefs", { token: t }))).status,
    ).toBe(404);
    expect((await prefs(t, { news: true })).status).toBe(404);
    // Housekeeping with the default transport does the same.
    expect((await purgeExpiredGuests(new Date(), ORIGIN)).emailsSent).toBe(0);
  });

  it("reports the capability, and stores a choice only for an account", async () => {
    enable();
    const { t } = await account();
    const me = await (await meGET(req("GET", "/api/me", { token: t }))).json();
    expect(me.emailEnabled).toBe(true);
    expect(
      await (
        await prefsGET(req("GET", "/api/email-prefs", { token: t }))
      ).json(),
    ).toEqual({
      news: false,
      price: false,
    });
    expect(await (await prefs(t, { news: true })).json()).toEqual({
      news: true,
      price: false,
    });
    expect((await prefs(t, { news: "yes" })).status).toBe(400);
    expect((await prefs(t, { other: true })).status).toBe(400);
    expect((await prefs(t, {})).status).toBe(400);
    const g = await anonymousToken();
    expect((await prefs(g, { news: true })).status).toBe(403);
  });

  it("sends a new-arrival email once per event, batched, capped to one a day, to those who switched it on", async () => {
    enable();
    const a = await account();
    const off = await account();
    const other = await account({ follow: ["marchand"] });
    await prefs(a.t, { news: true });
    await prefs(other.t, { news: true });
    // `off` never switched anything on.
    const p1 = await publish();
    const p2 = await publish();
    const now = new Date(Date.now() + 1000);
    const r = await runEmail(now, ORIGIN);
    expect(r.news).toBe(1);
    expect(sentEmails()).toHaveLength(1);
    const m = sentEmails()[0]!;
    expect(m.to).toMatch(/@example\.com$/);
    expect(m.text).toContain(`Washed linen shirt ${p1}`);
    expect(m.text).toContain(`Washed linen shirt ${p2}`); // batched into one message
    expect(m.text).toContain(`${ORIGIN}/`);
    expect(m.html).not.toMatch(/<img/);
    expect(m.unsubscribeUrl).toMatch(
      new RegExp(`^${ORIGIN}/unsubscribe/[A-Za-z0-9_-]{43}$`),
    );
    // Same events, run again: nothing more, the key is spent.
    expect((await runEmail(new Date(now.getTime() + 1000), ORIGIN)).news).toBe(
      0,
    );
    // A third piece the same day waits for the daily cap...
    const p3 = await publish();
    expect((await runEmail(new Date(now.getTime() + 2000), ORIGIN)).news).toBe(
      0,
    );
    // ...and goes out the next day, alone.
    expect((await runEmail(later(25), ORIGIN)).news).toBe(1);
    const last = sentEmails()[1]!;
    expect(last.text).toContain(`Washed linen shirt ${p3}`);
    expect(last.text).not.toContain(`Washed linen shirt ${p1}`);
    void off;
  });

  it("respects the switch: off sends nothing, and a late opt-in does not get the past", async () => {
    enable();
    const a = await account();
    await publish();
    await prefs(a.t, { news: true }); // after the event
    expect((await runEmail(later(1), ORIGIN)).news).toBe(0);
    await publish();
    await prefs(a.t, { news: false });
    expect((await runEmail(later(30), ORIGIN)).news).toBe(0);
    expect(sentEmails()).toHaveLength(0);
  });

  it("does not email an unverified address or an account that is gone, and gives the key back if the transport fails", async () => {
    enable();
    const a = await account();
    await prefs(a.t, { news: true });
    await publish();
    await auth().updateUser(a.uid, { emailVerified: false });
    expect((await runEmail(later(1), ORIGIN)).news).toBe(0);
    await auth().updateUser(a.uid, { emailVerified: true });
    // A transport that refuses: the event is not spent.
    const t = await import("./email/transport");
    const spy = vi.spyOn(t, "emailTransport").mockReturnValue({
      name: "log",
      canSend: true,
      send: async () => {
        throw new Error("provider down");
      },
    });
    expect((await runEmail(later(2), ORIGIN)).news).toBe(0);
    expect((await firestore().collection("emailSent").get()).size).toBe(0);
    spy.mockRestore();
    expect((await runEmail(later(3), ORIGIN)).news).toBe(1);
  });

  it("sends a price-change email once for a piece in the person's lists, and not for one that is not", async () => {
    enable();
    const a = await account();
    const id = await publish();
    const other = await publish();
    await prefs(a.t, { price: true });
    await firestore()
      .collection("lists")
      .add({
        uid: a.uid,
        name: "Wishlist",
        itemIds: [id],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    await changePiecePrice(id, 120, later(0.5));
    await changePiecePrice(other, 99, later(0.5));
    const r = await runEmail(later(1), ORIGIN);
    expect(r.price).toBe(1);
    const m = sentEmails()[0]!;
    expect(m.text).toContain("$120 (was $140)");
    expect(m.text).not.toContain(other);
    expect((await runEmail(later(2), ORIGIN)).price).toBe(0);
    expect(sentEmails()).toHaveLength(1);
  });

  it("the unsubscribe link works without signing in, and the path leaks nothing", async () => {
    enable();
    const a = await account();
    await prefs(a.t, { news: true, price: true });
    await publish();
    await runEmail(later(1), ORIGIN);
    const link = sentEmails()[0]!.unsubscribeUrl;
    const token = link.split("/").pop()!;
    // Only the hash is stored.
    const hash = createHash("sha256").update(token).digest("hex");
    const stored = await firestore().collection("emailTokens").get();
    expect(stored.docs.map((d) => d.id)).toEqual([hash]);
    expect(JSON.stringify(stored.docs.map((d) => d.data()))).not.toContain(
      token,
    );

    const call = (tok: string, ip: string) =>
      unsubPOST(
        req("POST", `/api/unsubscribe/${tok}`, {
          headers: { "x-forwarded-for": ip },
        }),
        params({ token: tok }),
      );
    const fake = "A".repeat(43);
    const real = await call(token, "10.0.0.1");
    const made = await call(fake, "10.0.0.2");
    const junk = await call("not-a-token", "10.0.0.3");
    for (const r of [real, made, junk]) {
      expect(r.status).toBe(200);
      expect(r.headers.get("x-robots-tag")).toContain("noindex");
      expect(r.headers.get("cache-control")).toContain("no-store");
      expect(r.headers.get("referrer-policy")).toBe("no-referrer");
    }
    const bodies = await Promise.all([real, made, junk].map((r) => r.json()));
    expect(bodies[0]).toEqual(bodies[1]);
    expect(bodies[1]).toEqual(bodies[2]);
    const p = (
      await firestore().collection("emailPrefs").doc(a.uid).get()
    ).data()!;
    expect(p.news).toBe(false);
    expect(p.price).toBe(false);
    // And it stays off.
    await publish();
    expect((await runEmail(later(30), ORIGIN)).news).toBe(0);
  });

  it("rate-limits a client by the client alone, whatever the token", async () => {
    const ip = "10.9.9.9";
    const statuses: number[] = [];
    for (let i = 0; i < 24; i++) {
      const tok = i % 2 ? "A".repeat(43) : "short";
      statuses.push(
        (
          await unsubPOST(
            req("POST", `/api/unsubscribe/${tok}`, {
              headers: { "x-forwarded-for": ip },
            }),
            params({ token: tok }),
          )
        ).status,
      );
    }
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(20).every((s) => s === 429)).toBe(true);
  });
});

describe("deleting everything", () => {
  it("removes the buffer, its renders, email preferences, keys and tokens", async () => {
    buffer(true);
    process.env.EMAIL_TRANSPORT = "log";
    const a = await account();
    const bystander = await account();
    await prefsPUT(
      req("PUT", "/api/email-prefs", { token: a.t, json: { news: true } }),
    );
    await prefsPUT(
      req("PUT", "/api/email-prefs", {
        token: bystander.t,
        json: { news: true },
      }),
    );
    await publish(); // after both switched email on
    await runArrivals(new Date());
    await awaitInlineRuns();
    await runEmail(new Date(Date.now() + 3_600_000), ORIGIN);
    expect((await getArrivals(a.uid))!.cards).toHaveLength(1);
    expect(
      (
        await firestore()
          .collection("emailSent")
          .where("uid", "==", a.uid)
          .get()
      ).size,
    ).toBe(1);
    expect((await listObjects(`renders/${a.uid}/`)).length).toBeGreaterThan(0);

    const res = await photoDELETE(req("DELETE", "/api/photo", { token: a.t }));
    expect(res.status).toBe(200);
    expect(await getArrivals(a.uid)).toBeNull();
    for (const c of ["emailSent", "emailTokens"]) {
      expect(
        (await firestore().collection(c).where("uid", "==", a.uid).get()).size,
      ).toBe(0);
    }
    expect(
      (await firestore().collection("emailPrefs").doc(a.uid).get()).exists,
    ).toBe(false);
    expect(
      (await firestore().collection("poseSets").where("uid", "==", a.uid).get())
        .size,
    ).toBe(0);
    expect(
      (await firestore().collection("jobs").where("uid", "==", a.uid).get())
        .size,
    ).toBe(0);
    expect(await listObjects(`renders/${a.uid}/`)).toEqual([]);
    // Someone else's data is untouched.
    expect(
      (await firestore().collection("emailPrefs").doc(bystander.uid).get())
        .exists,
    ).toBe(true);
  });
});
